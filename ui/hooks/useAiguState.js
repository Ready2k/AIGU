import { useState, useEffect, useCallback, useMemo } from 'react';
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

        // console.log(`signedFetch: ${method} ${url}`);

        if (DEV_MODE) {
            const creds = await getCredentials();
            if (creds) {
                const signedHeaders = await signRequest(url, method, options.body, creds);
                headers = { ...headers, ...signedHeaders };
            }
        }

        const response = await fetch(url, { ...options, headers });
        // console.log(`signedFetch response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`API Error: ${response.status} - ${txt}`);
        }
        // Handle text response (Reasoning CoT) vs JSON (State)
        const contentType = response.headers.get("content-type");
        console.log(`signedFetch contentType: ${contentType}`);

        if (contentType && contentType.includes("application/json")) {
            const json = await response.json();
            // console.log(`signedFetch JSON result:`, json);
            return json;
        }
        const text = await response.text();
        // console.log(`signedFetch text result:`, text);
        return text;
    }, []);

    // 1. Fetch State
    const fetchState = useCallback(async () => {
        try {
            const data = await signedFetch(`/state?submissionId=${encodeURIComponent(submissionId)}&userId=${encodeURIComponent(userId)}`);
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

        // Reset state when project ID changes to prevent stale syncing
        setLoading(true);
        setGlobalState(null);
        setError(null);

        fetchState();
        const intervalId = setInterval(() => {
            if (isMounted) fetchState();
        }, 10000); // Poll every 10 seconds instead of 5
        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [fetchState]);

    // 4. Agent Dispatchers
    const initiateIntake = useCallback(async (intakeData) => {
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
    }, [signedFetch, submissionId, userId]);

    const submitDelta = useCallback(async (deltaData) => {
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
    }, [signedFetch, submissionId, userId]);

    const updateConfig = useCallback(async (configData) => {
        try {
            await signedFetch('/config', {
                method: 'POST',
                body: JSON.stringify(configData)
            });
            fetchState();
        } catch (err) {
            setError(err);
        }
    }, [signedFetch, fetchState]);

    const fetchAdminQueue = useCallback(async () => {
        console.log("Fetching admin queue from /admin/list");
        const result = await signedFetch('/admin/list');
        console.log("Admin queue result:", result);
        return result || [];
    }, [signedFetch]);

    const fetchDelta = useCallback(async (currentId, previousId) => {
        try {
            console.log(`Fetching delta: ${currentId} vs ${previousId}`);
            const result = await signedFetch(`/delta?currentId=${encodeURIComponent(currentId)}&previousId=${encodeURIComponent(previousId)}`);
            return result;
        } catch (err) {
            console.error("Delta fetch failed", err);
            return null;
        }
    }, [signedFetch]);

    const fetchModels = useCallback(async () => {
        try {
            return await signedFetch('/models');
        } catch (err) {
            console.error("Failed to fetch models", err);
            return [];
        }
    }, [signedFetch]);

    const fetchSessions = useCallback(async (targetUserId) => {
        try {
            console.log(`Fetching sessions for user: ${targetUserId}`);
            return await signedFetch(`/sessions?userId=${encodeURIComponent(targetUserId)}`);
        } catch (err) {
            console.error("Failed to fetch sessions", err);
            return [];
        }
    }, [signedFetch]);

    const fetchConfig = useCallback(async () => {
        try {
            return await signedFetch('/config', { method: 'GET' });
        } catch (err) {
            console.error("Failed to fetch config", err);
            return {};
        }
    }, [signedFetch]);

    const adminAction = useCallback(async (targetSubmissionId, targetUserId, action, message = "") => {
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
    }, [signedFetch]);

    const submitPOC = useCallback(async (pocData) => {
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
    }, [signedFetch, submissionId, userId]);

    const submitProduction = useCallback(async (productionData, previousVersionId) => {
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
    }, [signedFetch, submissionId, userId]);

    const submitRevision = useCallback(async () => {
        setLoading(true);
        try {
            console.log("Submitting revision for", submissionId);
            const response = await signedFetch('/submit-revision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, userId })
            });

            // The backend returns { message, result: { ...new_state... } }
            // We should update the local state with the result from the graph invocation
            if (response.result) {
                setGlobalState(response.result);
            } else {
                fetchState(); // Fallback if full state isn't returned
            }
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [signedFetch, submissionId, userId, fetchState]);

    const getUploadUrl = useCallback(async (uploadData) => {
        try {
            console.log(`Getting upload URL for: ${uploadData.fileName}`);
            const result = await signedFetch('/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uploadData)
            });
            return result;
        } catch (err) {
            console.error("Failed to get upload URL", err);
            throw err;
        }
    }, [signedFetch]);

    const deleteArtifact = useCallback(async (fileName) => {
        setLoading(true);
        try {
            const response = await signedFetch('/upload', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, userId, fileName })
            });
            // Refetch state to get updated artifacts list
            fetchState();
            return response;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [signedFetch, submissionId, userId, fetchState]);

    const listFiles = useCallback(async (submissionIdOverride) => {
        try {
            const idToQuery = submissionIdOverride || submissionId;
            console.log(`Listing files for submission: ${idToQuery}`);
            const result = await signedFetch(`/files?submissionId=${encodeURIComponent(idToQuery)}&userId=${encodeURIComponent(userId)}`);
            return result || [];
        } catch (err) {
            console.error("Failed to list files", err);
            return [];
        }
    }, [signedFetch, userId]);

    const askSupportAgent = useCallback(async (requestData) => {
        try {
            console.log(`Asking support agent: ${requestData.message.substring(0, 50)}...`);
            const result = await signedFetch('/support/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            return result;
        } catch (err) {
            console.error("Support agent request failed", err);
            throw err;
        }
    }, [signedFetch]);

    const fetchPrompts = useCallback(async () => {
        console.log("Fetching prompts from /admin/prompts");
        try {
            const result = await signedFetch('/admin/prompts');
            return result || [];
        } catch (err) {
            console.error("Failed to fetch prompts", err);
            return [];
        }
    }, [signedFetch]);

    const updatePrompt = useCallback(async (name, content, tags = ['production']) => {
        try {
            console.log(`Updating prompt: ${name}`);
            const result = await signedFetch('/admin/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, content, tags })
            });
            return result;
        } catch (err) {
            console.error("Failed to update prompt", err);
            throw err;
        }
    }, [signedFetch]);

    const deleteProject = useCallback(async (targetSubmissionId, targetUserId) => {
        try {
            console.log(`Deleting project: ${targetSubmissionId} for user: ${targetUserId}`);
            await signedFetch(`/state?submissionId=${encodeURIComponent(targetSubmissionId)}&userId=${encodeURIComponent(targetUserId)}`, {
                method: 'DELETE'
            });
            console.log("Project deleted successfully");
            return true;
        } catch (err) {
            console.error("Delete project failed", err);
            return false;
        }
    }, [signedFetch]);

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
        actions: useMemo(() => ({
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
            fetchSessions,
            fetchConfig,
            adminAction,
            deleteProject,
            getUploadUrl,
            listFiles,
            askSupportAgent,
            fetchPrompts,
            updatePrompt,
            submitRevision,
            deleteArtifact
        }), [initiateIntake, submitPOC, submitProduction, submitDelta, updateConfig, fetchState, fetchReasoning, fetchAdminQueue, fetchDelta, fetchModels, fetchSessions, fetchConfig, adminAction, deleteProject, getUploadUrl, listFiles, askSupportAgent, fetchPrompts, updatePrompt, submitRevision, deleteArtifact]),
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
