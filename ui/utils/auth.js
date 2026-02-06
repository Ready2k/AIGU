import AsyncStorage from '@react-native-async-storage/async-storage';
import { AwsClient } from 'aws4fetch';

const AUTH_KEYS = {
    ACCESS_KEY: 'aigu_access_key',
    SECRET_KEY: 'aigu_secret_key',
    SESSION_TOKEN: 'aigu_session_token'
};

export const saveCredentials = async (creds) => {
    try {
        await AsyncStorage.multiSet([
            [AUTH_KEYS.ACCESS_KEY, creds.accessKeyId],
            [AUTH_KEYS.SECRET_KEY, creds.secretAccessKey],
            [AUTH_KEYS.SESSION_TOKEN, creds.sessionToken]
        ]);
        return true;
    } catch (e) {
        console.error("Failed to save credentials", e);
        return false;
    }
};

// Fallback static credentials for demo/corporate environments
const STATIC_CREDS = {
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: ""
};

export const getCredentials = async () => {
    // 1. Check for hardcoded static credentials first (Priority)
    if (STATIC_CREDS.accessKeyId && STATIC_CREDS.secretAccessKey) {
        return STATIC_CREDS;
    }

    // 2. Fall back to Dynamic Session (Stored in AsyncStorage)
    try {
        const values = await AsyncStorage.multiGet([
            AUTH_KEYS.ACCESS_KEY,
            AUTH_KEYS.SECRET_KEY,
            AUTH_KEYS.SESSION_TOKEN
        ]);
        const creds = Object.fromEntries(values);

        if (creds[AUTH_KEYS.ACCESS_KEY] && creds[AUTH_KEYS.SECRET_KEY]) {
            return {
                accessKeyId: creds[AUTH_KEYS.ACCESS_KEY],
                secretAccessKey: creds[AUTH_KEYS.SECRET_KEY],
                sessionToken: creds[AUTH_KEYS.SESSION_TOKEN]
            };
        }
        return null;
    } catch (e) {
        return null;
    }
};

/**
 * Signs a request using AWS Signature V4 via aws4fetch
 */
export const signRequest = async (url, method, body, credentials) => {
    if (!credentials) return {};

    const aws = new AwsClient({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        region: 'us-east-1',
        service: 'execute-api'
    });

    // AwsClient.sign() returns a Request object (or similar) with signed headers
    // In many versions it returns the fetch options.
    const signedRequest = await aws.sign(url, {
        method,
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Extract headers object from the signed request/options
    const headers = {};
    signedRequest.headers.forEach((value, key) => {
        headers[key] = value;
    });

    return headers;
};
