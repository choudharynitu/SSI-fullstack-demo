import { Router } from 'express';
import { agent } from '../agent.js';
import { verifyJWT } from 'did-jwt';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
export const router = Router();
// Use the existing Veramo agent's resolver
// const resolver = agent.getDIDResolver();
// In-memory storage for presentation requests (in production, use a database)
const presentationRequests = new Map();
const presentationSessions = new Map();
// OID4VP: Create presentation request
router.post('/presentation-request', async (req, res) => {
    try {
        const { presentation_definition, client_id, redirect_uri, response_mode = 'direct_post', response_type = 'vp_token', nonce, state, } = req.body;
        // Generate unique request ID
        const requestId = nanoid();
        const generatedNonce = nonce || crypto.randomBytes(16).toString('hex');
        const generatedState = state || nanoid();
        // Create presentation request
        const presentationRequest = {
            id: requestId,
            client_id: client_id || 'verifier-demo',
            redirect_uri: redirect_uri || `${req.protocol}://${req.get('host')}/api/oid4vp/presentation-response`,
            response_type,
            response_mode,
            presentation_definition: presentation_definition || {
                id: nanoid(),
                input_descriptors: [
                    {
                        id: 'any_credential',
                        name: 'Any Verifiable Credential',
                        purpose: 'Please provide any verifiable credential',
                        constraints: {
                            fields: [
                                {
                                    path: ['$.type'],
                                    filter: {
                                        type: 'array',
                                        contains: {
                                            const: 'VerifiableCredential'
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            nonce: generatedNonce,
            state: generatedState,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        };
        // Store the request
        presentationRequests.set(requestId, presentationRequest);
        // Create OID4VP request URI
        const baseUrl = `${req.protocol}://${req.get('host')}/api/oid4vp`;
        const requestUri = `openid4vp://?client_id=${encodeURIComponent(presentationRequest.client_id)}&request_uri=${encodeURIComponent(`${baseUrl}/request/${requestId}`)}`;
        res.json({
            success: true,
            request_id: requestId,
            request_uri: requestUri,
            direct_request_url: `${baseUrl}/request/${requestId}`,
            presentation_request: presentationRequest,
        });
    }
    catch (error) {
        console.error('Error creating presentation request:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create presentation request',
        });
    }
});
// OID4VP: Get presentation request by ID
router.get('/request/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const request = presentationRequests.get(requestId);
        if (!request) {
            res.status(404).json({
                error: 'invalid_request',
                error_description: 'Presentation request not found or expired',
            });
            return;
        }
        // Check if request has expired
        if (new Date() > new Date(request.expires_at)) {
            presentationRequests.delete(requestId);
            res.status(400).json({
                error: 'invalid_request',
                error_description: 'Presentation request has expired',
            });
            return;
        }
        // Return the presentation request in OID4VP format
        res.json({
            client_id: request.client_id,
            redirect_uri: request.redirect_uri,
            response_type: request.response_type,
            response_mode: request.response_mode,
            presentation_definition: request.presentation_definition,
            nonce: request.nonce,
            state: request.state,
        });
    }
    catch (error) {
        console.error('Error retrieving presentation request:', error);
        res.status(500).json({
            error: 'server_error',
            error_description: error.message || 'Internal server error',
        });
    }
});
// OID4VP: Receive presentation response
router.post('/presentation-response', async (req, res) => {
    try {
        const { vp_token, presentation_submission, state } = req.body;
        if (!vp_token) {
            res.status(400).json({
                error: 'invalid_request',
                error_description: 'Missing vp_token',
            });
            return;
        }
        // Find the corresponding request using state
        const request = Array.from(presentationRequests.values()).find(r => r.state === state);
        if (!request) {
            res.status(400).json({
                error: 'invalid_request',
                error_description: 'Invalid state parameter',
            });
            return;
        }
        // Verify the presentation
        let verificationResult = {
            valid: false,
            errors: [],
            credentials: [],
        };
        try {
            if (typeof vp_token === 'string') {
                // JWT VP - use Veramo agent for verification
                const vpResult = await verifyJWT(vp_token, { audience: request.client_id });
                const payload = vpResult.payload;
                // Verify nonce
                if (payload.nonce !== request.nonce) {
                    verificationResult.errors.push('Nonce mismatch');
                }
                else {
                    verificationResult.valid = true;
                    verificationResult.holder = vpResult.issuer;
                    verificationResult.nonce = payload.nonce;
                    verificationResult.audience = payload.aud;
                    // Verify embedded credentials
                    if (payload.vp && payload.vp.verifiableCredential) {
                        const credentials = Array.isArray(payload.vp.verifiableCredential)
                            ? payload.vp.verifiableCredential
                            : [payload.vp.verifiableCredential];
                        for (const cred of credentials) {
                            try {
                                // Use Veramo agent for credential verification
                                const credResult = await agent.verifyCredential({ credential: cred });
                                verificationResult.credentials.push({
                                    valid: credResult.verified,
                                    credential: cred,
                                    issuer: typeof cred === 'string' ? 'JWT' : cred.issuer,
                                    subject: typeof cred === 'string' ? 'JWT' : cred.credentialSubject?.id,
                                    type: typeof cred === 'string' ? ['VerifiableCredential'] : cred.type,
                                    result: credResult,
                                });
                            }
                            catch (credError) {
                                verificationResult.credentials.push({
                                    valid: false,
                                    error: credError.message,
                                    raw_credential: cred,
                                });
                            }
                        }
                    }
                }
            }
            else {
                // JSON-LD VP
                try {
                    const vpResult = await agent.verifyPresentation({
                        presentation: vp_token,
                        challenge: request.nonce,
                        domain: request.client_id,
                    });
                    verificationResult.valid = vpResult.verified;
                    verificationResult.holder = vp_token.holder;
                    if (!vpResult.verified && vpResult.error) {
                        verificationResult.errors.push(vpResult.error.message);
                    }
                    // Verify embedded credentials
                    const credentials = vp_token.verifiableCredential || [];
                    for (const cred of credentials) {
                        try {
                            const credResult = await agent.verifyCredential({ credential: cred });
                            verificationResult.credentials.push({
                                valid: credResult.verified,
                                credential: cred,
                                result: credResult,
                            });
                        }
                        catch (credError) {
                            verificationResult.credentials.push({
                                valid: false,
                                error: credError.message,
                            });
                        }
                    }
                }
                catch (jsonError) {
                    verificationResult.errors.push(`JSON-LD VP verification failed: ${jsonError.message}`);
                }
            }
            // Create session for result retrieval
            const sessionId = nanoid();
            presentationSessions.set(sessionId, {
                request_id: request.id,
                verification_result: verificationResult,
                presentation_submission,
                timestamp: new Date().toISOString(),
                expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
            });
            // Clean up the request
            presentationRequests.delete(request.id);
            res.json({
                success: true,
                session_id: sessionId,
                verification_result: verificationResult,
            });
        }
        catch (verifyError) {
            console.error('Presentation verification error:', verifyError);
            res.status(400).json({
                error: 'invalid_presentation',
                error_description: verifyError.message || 'Failed to verify presentation',
            });
        }
    }
    catch (error) {
        console.error('Error processing presentation response:', error);
        res.status(500).json({
            error: 'server_error',
            error_description: error.message || 'Internal server error',
        });
    }
});
// Get verification result by session ID
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = presentationSessions.get(sessionId);
        if (!session) {
            res.status(404).json({
                success: false,
                error: 'Session not found or expired',
            });
            return;
        }
        // Check if session has expired
        if (new Date() > new Date(session.expires_at)) {
            presentationSessions.delete(sessionId);
            res.status(400).json({
                success: false,
                error: 'Session has expired',
            });
            return;
        }
        res.json({
            success: true,
            session: session,
        });
    }
    catch (error) {
        console.error('Error retrieving session:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});
// Create specific presentation definition for credential types
router.post('/create-presentation-definition', async (req, res) => {
    try {
        const { credential_types = [], required_fields = [], trusted_issuers = [], purpose = 'Credential verification', } = req.body;
        const presentationDefinition = {
            id: nanoid(),
            name: 'Verifier Presentation Request',
            purpose,
            input_descriptors: [
                {
                    id: 'credential_input',
                    name: 'Required Credential',
                    purpose,
                    constraints: {
                        fields: [
                            // Credential type constraint
                            {
                                path: ['$.type'],
                                filter: {
                                    type: 'array',
                                    contains: {
                                        enum: credential_types.length > 0 ? credential_types : ['VerifiableCredential']
                                    }
                                }
                            },
                            // Trusted issuer constraint (if specified)
                            ...(trusted_issuers.length > 0 ? [{
                                    path: ['$.issuer'],
                                    filter: {
                                        type: 'string',
                                        enum: trusted_issuers
                                    }
                                }] : []),
                            // Required fields constraints
                            ...required_fields.map((field) => ({
                                path: [`$.credentialSubject.${field}`],
                                filter: {
                                    type: 'string',
                                    minLength: 1
                                }
                            })),
                        ]
                    }
                }
            ]
        };
        res.json({
            success: true,
            presentation_definition: presentationDefinition,
        });
    }
    catch (error) {
        console.error('Error creating presentation definition:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create presentation definition',
        });
    }
});
// List active presentation requests
router.get('/requests', async (req, res) => {
    try {
        const activeRequests = Array.from(presentationRequests.entries())
            .filter(([_, request]) => new Date() < new Date(request.expires_at))
            .map(([id, request]) => ({
            id,
            client_id: request.client_id,
            created_at: request.created_at,
            expires_at: request.expires_at,
            presentation_definition: request.presentation_definition,
        }));
        res.json({
            success: true,
            requests: activeRequests,
            count: activeRequests.length,
        });
    }
    catch (error) {
        console.error('Error listing requests:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});
// List verification sessions
router.get('/sessions', async (req, res) => {
    try {
        const activeSessions = Array.from(presentationSessions.entries())
            .filter(([_, session]) => new Date() < new Date(session.expires_at))
            .map(([id, session]) => ({
            session_id: id,
            request_id: session.request_id,
            timestamp: session.timestamp,
            expires_at: session.expires_at,
            verification_result: {
                valid: session.verification_result.valid,
                credentials_count: session.verification_result.credentials?.length || 0,
            },
        }));
        res.json({
            success: true,
            sessions: activeSessions,
            count: activeSessions.length,
        });
    }
    catch (error) {
        console.error('Error listing sessions:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});
// Health check
router.get('/health', async (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        active_requests: presentationRequests.size,
        active_sessions: presentationSessions.size,
    });
});
export default router;
