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

        console.log(`signedFetch: ${method} ${url}`);

        if (DEV_MODE) {
            const creds = await getCredentials();
            if (creds) {
                const signedHeaders = await signRequest(url, method, options.body, creds);
                headers = { ...headers, ...signedHeaders };
            }
        }

        const response = await fetch(url, { ...options, headers });
        console.log(`signedFetch response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`API Error: ${response.status} - ${txt}`);
        }
        // Handle text response (Reasoning CoT) vs JSON (State)
        const contentType = response.headers.get("content-type");
        console.log(`signedFetch contentType: ${contentType}`);

        if (contentType && contentType.includes("application/json")) {
            const json = await response.json();
            console.log(`signedFetch JSON result:`, json);
            return json;
        }
        const text = await response.text();
        console.log(`signedFetch text result:`, text);
        return text;
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

    const fetchAdminQueue = async () => {
        console.log("Fetching admin queue from /admin/list");
        const result = await signedFetch('/admin/list');
        console.log("Admin queue result:", result);
        return result || [];
    };

    const fetchDelta = async (currentId, previousId) => {
        try {
            console.log(`Fetching delta: ${currentId} vs ${previousId}`);
            const result = await signedFetch(`/delta?currentId=${currentId}&previousId=${previousId}`);
            return result;
        } catch (err) {
            console.error("Delta fetch failed", err);
            return null;
        }
    };

    const fetchModels = async () => {
        try {
            return await signedFetch('/models');
        } catch (err) {
            console.error("Failed to fetch models", err);
            return [];
        }
    };

    const fetchConfig = async () => {
        try {
            return await signedFetch('/config', { method: 'GET' });
        } catch (err) {
            console.error("Failed to fetch config", err);
            return {};
        }
    };

    const adminAction = async (targetSubmissionId, targetUserId, action, message = "") => {
        try {
            console.log("adminAction called:", { targetSubmissionId, targetUserId, action, message });
            const result = await signedFetch('/invoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent: 'admin_action',
                    submissionId: targetSubmissionId,
                    userId: targetUserId,
                    payload: { action, message }
                })
            });
            console.log("adminAction result:", result);
            return true;
        } catch (err) {
            console.error("Admin action failed", err);
            return false;
        }
    };

    const submitPOC = async (pocData) => {
        setLoading(true);
        try {
            const newState = await signedFetch('/invoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent: 'poc', submissionId, userId, payload: { pocData } })
            });
            setGlobalState(newState);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const submitProduction = async (productionData, previousVersionId) => {
        setLoading(true);
        try {
            const newState = await signedFetch('/invoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent: 'production',
                    submissionId,
                    userId,
                    payload: { productionData, previousVersionId }
                })
            });
            setGlobalState(newState);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const governance = globalState?.governance || {};
    const status = governance.status;
    const blockers = governance.blockers || [];
    const currentStage = globalState?.projectMetadata?.currentStage || 'Intake';

    const isBlocked = status === 'Blocked';
    const isInReview = status === 'In-Review' || status === 'InReview' || status === 'Pending';
    const isApproved = status === 'Approved' || status === 'POC-Approved' || status === 'Production-Ready' || status === 'Live';

    // Engaged means the project has started governance (past initial intake)
    const isEngaged = currentStage !== 'Intake' || (status !== 'Draft' && status !== 'New' && !!status);
    const isDeltaBlocked = isBlocked && (blockers.some(b => b.includes("Delta")) || blockers.some(b => b.includes("threshold")));

    return {
        state: globalState,
        loading,
        error,
        actions: {
            initiateIntake,
            submitPOC,
            submitProduction,
            submitDelta,
            updateConfig,
            refreshState: fetchState,
            fetchReasoning,
            fetchAdminQueue,
            fetchDelta,
            fetchModels,
            fetchConfig,
            adminAction
        },
        computed: {
            isBlocked,
            isInReview,
            isApproved,
            isEngaged,
            isDeltaBlocked,
            blockers,
            currentStage,
            riskLevel: globalState?.projectMetadata?.riskLevel || 'Low',
            path: globalState?.projectMetadata?.path || 'Standard'
        }
    };
};
