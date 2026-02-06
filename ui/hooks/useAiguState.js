import { useState, useEffect, useCallback } from 'react';
import { getCredentials, signRequest } from '../utils/auth';

// Configuration
const API_URL = 'https://7rhp69zmfh.execute-api.us-east-1.amazonaws.com/v1';
const DEV_MODE = true;

export const useAiguState = (submissionId, userId) => {
    const [globalState, setGlobalState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Helper: Signed Fetch Wrapper
    const signedFetch = useCallback(async (endpoint, options = {}) => {
        const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
        const method = options.method || 'GET';
        let headers = { ...options.headers };

        if (DEV_MODE) {
            const creds = await getCredentials();
            if (creds) {
                const signedHeaders = await signRequest(url, method, options.body, creds);
                headers = { ...headers, ...signedHeaders };
            }
        }

        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`API Error: ${response.status} - ${txt}`);
        }
        // Handle text response (Reasoning CoT) vs JSON (State)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return response.json();
        }
        return response.text();
    }, []);

    // 1. Fetch State
    const fetchState = useCallback(async () => {
        try {
            const data = await signedFetch(`/state?submissionId=${submissionId}&userId=${userId}`);
            setGlobalState(data);
            setError(null);
        } catch (err) {
            console.error("Failed to sync AIGU state", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [submissionId, userId, signedFetch]);

    // 2. Fetch Reasoning
    const fetchReasoning = useCallback(async (s3Uri) => {
        if (!s3Uri) return "Invalid URI";

        // Strategy A: Pre-Signed URL (Production)
        const presignedMap = globalState?.ui_overlay?.reasoningUrls || {};
        const presignedUrl = presignedMap[s3Uri];

        if (presignedUrl) {
            try {
                const response = await fetch(presignedUrl);
                return await response.text();
            } catch (e) {
                console.error("Failed to fetch from S3 Presigned URL", e);
                return "Failed to load reasoning content.";
            }
        }

        // Strategy B: Dev / Simulation Fallback
        if (DEV_MODE) {
            return "Simulated Chain-of-Thought Reasoning (Dev Mode)\n\n1. Analysis: Detected Keywords...\n2. Decision: Approved.";
        }

        return "Reasoning not accessible (Link Expired)";
    }, [globalState]);

    // 3. State Subscription
    useEffect(() => {
        let isMounted = true;
        fetchState();
        const intervalId = setInterval(() => {
            if (isMounted) fetchState();
        }, 5000);
        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [fetchState]);

    // 4. Agent Dispatchers
    const initiateIntake = async (intakeData) => {
        setLoading(true);
        try {
            const newState = await signedFetch('/invoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent: 'intake', submissionId, userId, payload: intakeData })
            });
            setGlobalState(newState);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const submitDelta = async (deltaData) => {
        setLoading(true);
        try {
            const newState = await signedFetch('/invoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent: 'outcome', submissionId, userId, payload: deltaData })
            });
            setGlobalState(newState);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const updateConfig = async (configData) => {
        try {
            await signedFetch('/config', {
                method: 'POST',
                body: JSON.stringify(configData)
            });
            fetchState();
        } catch (err) {
            setError(err);
        }
    };

    const governance = globalState?.governance || {};
    const status = governance.status;
    const blockers = governance.blockers || [];
    const isBlocked = status === 'Blocked';
    const isDeltaBlocked = isBlocked && blockers.some(b => b.includes("Delta Threshold"));

    return {
        state: globalState,
        loading,
        error,
        actions: {
            initiateIntake,
            submitDelta,
            updateConfig,
            refreshState: fetchState,
            fetchReasoning // Exported for LogViewer
        },
        computed: {
            isBlocked,
            isDeltaBlocked,
            blockers,
            currentStage: globalState?.projectMetadata?.currentStage || 'Intake',
            riskLevel: globalState?.projectMetadata?.riskLevel || 'Low'
        }
    };
};
