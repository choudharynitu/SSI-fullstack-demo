import { agent } from './agent.js';
import { createJWT } from 'did-jwt';
import { nanoid } from 'nanoid';
import axios from 'axios';
export class OID4VPWalletClient {
    constructor() {
        this.walletDID = null;
    }
    async initialize(walletDID) {
        this.walletDID = walletDID;
        console.log('🔧 OID4VP Wallet Client initialized');
    }
    /**
     * Parse OID4VP request URI to extract request parameters
     */
    parseRequestUri(requestUri) {
        try {
            // Handle openid4vp:// scheme properly
            let url;
            if (requestUri.startsWith('openid4vp://')) {
                const urlWithoutScheme = requestUri.replace('openid4vp://', '');
                if (urlWithoutScheme.startsWith('?')) {
                    // Case: openid4vp://?query=params
                    url = new URL('https://example.com' + urlWithoutScheme);
                }
                else {
                    // Case: openid4vp://host/path?query=params
                    url = new URL('https://' + urlWithoutScheme);
                }
            }
            else {
                // Handle other schemes or direct URLs
                url = new URL(requestUri);
            }
            const clientId = url.searchParams.get('client_id');
            const requestUriParam = url.searchParams.get('request_uri');
            if (!requestUriParam) {
                throw new Error('No request_uri parameter found');
            }
            return {
                requestUri: decodeURIComponent(requestUriParam),
                clientId: clientId || undefined,
            };
        }
        catch (error) {
            console.error('Error parsing request URI:', error);
            throw new Error(`Invalid OID4VP request URI: ${requestUri}`);
        }
    }
    /**
     * Fetch presentation request from verifier
     */
    async fetchPresentationRequest(requestUri) {
        try {
            const response = await axios.get(requestUri);
            if (response.status !== 200) {
                throw new Error(`Failed to fetch presentation request: ${response.statusText}`);
            }
            const request = response.data;
            console.log('📨 Received presentation request from verifier');
            console.log('🎯 Purpose:', request.presentation_definition.purpose || 'Not specified');
            return request;
        }
        catch (error) {
            console.error('Error fetching presentation request:', error);
            throw error;
        }
    }
    /**
     * Evaluate which stored credentials match the presentation requirements
     */
    async evaluateCredentialsForRequest(presentationDefinition) {
        try {
            // Get all stored credentials
            const storedCredentials = await agent.dataStoreORMGetVerifiableCredentials();
            console.log(`🔍 Evaluating ${storedCredentials.length} stored credentials against presentation requirements`);
            const matchingCredentials = [];
            for (let i = 0; i < storedCredentials.length; i++) {
                const storedCred = storedCredentials[i];
                const credential = storedCred.verifiableCredential;
                console.log(`\n📄 Checking credential ${i + 1}:`);
                console.log(`   Type: ${JSON.stringify(credential.type)}`);
                console.log(`   Subject: ${JSON.stringify(credential.credentialSubject)}`);
                // Check each input descriptor
                for (const inputDescriptor of presentationDefinition.input_descriptors) {
                    console.log(`   🎯 Testing against input descriptor: ${inputDescriptor.id}`);
                    const matches = this.checkCredentialMatches(credential, inputDescriptor);
                    console.log(`   ✅ Matches: ${matches}`);
                    if (matches) {
                        matchingCredentials.push({
                            credential,
                            credentialHash: storedCred.hash,
                            matchesRequirements: true,
                        });
                        console.log(`   ➕ Added to matching credentials`);
                        break; // Don't add the same credential multiple times
                    }
                }
            }
            console.log(`📋 Found ${matchingCredentials.length} matching credentials`);
            return matchingCredentials;
        }
        catch (error) {
            console.error('Error evaluating credentials:', error);
            return [];
        }
    }
    /**
     * Check if a credential matches an input descriptor's requirements
     */
    checkCredentialMatches(credential, inputDescriptor) {
        try {
            console.log(`     🔍 Checking ${inputDescriptor.constraints.fields.length} field constraints`);
            for (let j = 0; j < inputDescriptor.constraints.fields.length; j++) {
                const fieldConstraint = inputDescriptor.constraints.fields[j];
                console.log(`     📋 Field ${j + 1}: path=${JSON.stringify(fieldConstraint.path)}`);
                const fieldValue = this.extractFieldValue(credential, fieldConstraint.path);
                console.log(`     📄 Field value: ${JSON.stringify(fieldValue)}`);
                console.log(`     🎯 Filter: ${JSON.stringify(fieldConstraint.filter)}`);
                const constraintMet = this.checkFieldConstraint(fieldValue, fieldConstraint);
                console.log(`     ✅ Constraint met: ${constraintMet}`);
                if (!constraintMet) {
                    console.log(`     ❌ Failed field constraint ${j + 1}`);
                    return false;
                }
            }
            console.log(`     ✅ All constraints passed`);
            return true;
        }
        catch (error) {
            console.error('Error checking credential match:', error);
            return false;
        }
    }
    /**
     * Extract field value from credential using JSONPath-like syntax
     */
    extractFieldValue(credential, path) {
        let current = credential;
        for (const pathSegment of path) {
            if (pathSegment.startsWith('$.')) {
                // Handle JSONPath syntax like "$.credentialSubject.Name"
                const fieldPath = pathSegment.substring(2); // Remove "$."
                const fields = fieldPath.split('.'); // Split by "."
                for (const field of fields) {
                    current = current[field];
                    if (current === undefined) {
                        return undefined;
                    }
                }
            }
            else {
                current = current[pathSegment];
                if (current === undefined) {
                    return undefined;
                }
            }
        }
        return current;
    }
    /**
     * Check if field value satisfies the constraint
     */
    checkFieldConstraint(fieldValue, constraint) {
        if (fieldValue === undefined || fieldValue === null) {
            return constraint.optional === true;
        }
        if (!constraint.filter) {
            return true; // No specific filter, just needs to exist
        }
        const filter = constraint.filter;
        // Type check
        if (filter.type === 'string' && typeof fieldValue !== 'string') {
            return false;
        }
        if (filter.type === 'array' && !Array.isArray(fieldValue)) {
            return false;
        }
        // Array contains check
        if (filter.type === 'array' && filter.contains) {
            if (filter.contains.const) {
                return fieldValue.includes(filter.contains.const);
            }
            if (filter.contains.enum) {
                return filter.contains.enum.some((enumValue) => fieldValue.includes(enumValue));
            }
        }
        // String length check
        if (filter.minLength && typeof fieldValue === 'string') {
            return fieldValue.length >= filter.minLength;
        }
        // Enum check
        if (filter.enum && Array.isArray(filter.enum)) {
            return filter.enum.includes(fieldValue);
        }
        return true;
    }
    /**
     * Create verifiable presentation from selected credentials
     */
    async createVerifiablePresentation(selectedCredentials, presentationRequest) {
        if (!this.walletDID) {
            throw new Error('Wallet not initialized');
        }
        try {
            const identifier = await agent.didManagerGet({ did: this.walletDID });
            const keyId = identifier.keys[0]?.kid;
            if (!keyId) {
                throw new Error('No signing key found for wallet');
            }
            // Create VP payload
            const vpPayload = {
                iss: this.walletDID, // Holder/Wallet DID
                aud: presentationRequest.client_id, // Verifier client ID
                nonce: presentationRequest.nonce,
                jti: nanoid(),
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes expiry
                vp: {
                    '@context': ['https://www.w3.org/2018/credentials/v1'],
                    type: ['VerifiablePresentation'],
                    holder: this.walletDID,
                    verifiableCredential: selectedCredentials.map((sc) => sc.credential),
                },
            };
            // Create VP JWT using did-jwt with EdDSA algorithm for Ed25519 keys
            const vpJWT = await createJWT(vpPayload, {
                issuer: this.walletDID,
                alg: 'EdDSA',
                signer: async (data) => {
                    const dataToSign = typeof data === 'string' ? data : new TextDecoder().decode(data);
                    const signature = await agent.keyManagerSign({
                        keyRef: keyId,
                        data: dataToSign,
                    });
                    // Return the signature as string (did-jwt handles the format internally)
                    return signature;
                }
            });
            console.log('🔐 Created verifiable presentation with PoP signature');
            return vpJWT;
        }
        catch (error) {
            console.error('Error creating verifiable presentation:', error);
            throw error;
        }
    }
    /**
     * Submit presentation to verifier
     */
    async submitPresentation(presentationJWT, presentationRequest) {
        try {
            const submissionData = {
                vp_token: presentationJWT,
                presentation_submission: {
                    id: nanoid(),
                    definition_id: presentationRequest.presentation_definition.id,
                    descriptor_map: presentationRequest.presentation_definition.input_descriptors.map((desc, index) => ({
                        id: desc.id,
                        format: 'jwt_vp',
                        path: `$.vp.verifiableCredential[${index}]`,
                    })),
                },
                state: presentationRequest.state,
            };
            const response = await axios.post(presentationRequest.redirect_uri, submissionData, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.status !== 200) {
                throw new Error(`Presentation submission failed: ${response.statusText}`);
            }
            console.log('✅ Presentation submitted successfully to verifier');
            return response.data;
        }
        catch (error) {
            console.error('Error submitting presentation:', error);
            throw error;
        }
    }
    /**
     * Complete OID4VP flow: parse request, select credentials, create presentation, submit
     */
    async respondToPresentationRequest(requestUri, autoSelectCredentials = true, userSelectedCredentialHashes) {
        console.log('🎯 Starting OID4VP presentation flow...');
        try {
            // Parse the request URI
            const { requestUri: actualRequestUri } = this.parseRequestUri(requestUri);
            // Fetch the presentation request from verifier
            const presentationRequest = await this.fetchPresentationRequest(actualRequestUri);
            // Find matching credentials
            const matchingCredentials = await this.evaluateCredentialsForRequest(presentationRequest.presentation_definition);
            if (matchingCredentials.length === 0) {
                throw new Error('No credentials found that match the verifier requirements');
            }
            // Select credentials (auto-select or user selection)
            let selectedCredentials = matchingCredentials;
            if (!autoSelectCredentials && userSelectedCredentialHashes) {
                selectedCredentials = matchingCredentials.filter((cred) => userSelectedCredentialHashes.includes(cred.credentialHash));
            }
            if (selectedCredentials.length === 0) {
                throw new Error('No valid credentials selected for presentation');
            }
            console.log(`📤 Presenting ${selectedCredentials.length} credential(s) to verifier`);
            // Create verifiable presentation with PoP
            const presentationJWT = await this.createVerifiablePresentation(selectedCredentials, presentationRequest);
            // Submit to verifier
            const submissionResult = await this.submitPresentation(presentationJWT, presentationRequest);
            console.log('✅ OID4VP flow completed successfully!');
            return {
                success: true,
                sessionId: submissionResult.session_id,
            };
        }
        catch (error) {
            console.error('❌ OID4VP flow failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Get presentation history and status
     */
    async getPresentationHistory() {
        // In a real implementation, this would store presentation history
        // For now, return empty array as we're focusing on the core flow
        return [];
    }
    /**
     * Preview what would be shared with verifier without actually submitting
     */
    async previewPresentationForRequest(requestUri) {
        try {
            const { requestUri: actualRequestUri } = this.parseRequestUri(requestUri);
            const presentationRequest = await this.fetchPresentationRequest(actualRequestUri);
            const matchingCredentials = await this.evaluateCredentialsForRequest(presentationRequest.presentation_definition);
            return {
                verifier: presentationRequest.client_id,
                purpose: presentationRequest.presentation_definition.purpose || 'Not specified',
                requiredCredentials: presentationRequest.presentation_definition.input_descriptors,
                matchingCredentials,
            };
        }
        catch (error) {
            console.error('Error previewing presentation:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=oid4vp-client.js.map