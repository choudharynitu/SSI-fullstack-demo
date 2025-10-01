export interface PresentationRequest {
    client_id: string;
    redirect_uri: string;
    response_type: string;
    response_mode: string;
    presentation_definition: PresentationDefinition;
    nonce: string;
    state: string;
}
export interface PresentationDefinition {
    id: string;
    name?: string;
    purpose?: string;
    input_descriptors: InputDescriptor[];
}
export interface InputDescriptor {
    id: string;
    name?: string;
    purpose?: string;
    constraints: {
        fields: FieldConstraint[];
    };
}
export interface FieldConstraint {
    path: string[];
    filter?: any;
    optional?: boolean;
}
export interface SelectedCredential {
    credential: any;
    credentialHash: string;
    matchesRequirements: boolean;
}
export declare class OID4VPWalletClient {
    private walletDID;
    initialize(walletDID: string): Promise<void>;
    /**
     * Parse OID4VP request URI to extract request parameters
     */
    parseRequestUri(requestUri: string): {
        requestUri: string;
        clientId?: string;
    };
    /**
     * Fetch presentation request from verifier
     */
    fetchPresentationRequest(requestUri: string): Promise<PresentationRequest>;
    /**
     * Evaluate which stored credentials match the presentation requirements
     */
    evaluateCredentialsForRequest(presentationDefinition: PresentationDefinition): Promise<SelectedCredential[]>;
    /**
     * Check if a credential matches an input descriptor's requirements
     */
    private checkCredentialMatches;
    /**
     * Extract field value from credential using JSONPath-like syntax
     */
    private extractFieldValue;
    /**
     * Check if field value satisfies the constraint
     */
    private checkFieldConstraint;
    /**
     * Create verifiable presentation from selected credentials
     */
    createVerifiablePresentation(selectedCredentials: SelectedCredential[], presentationRequest: PresentationRequest): Promise<string>;
    /**
     * Submit presentation to verifier
     */
    submitPresentation(presentationJWT: string, presentationRequest: PresentationRequest): Promise<any>;
    /**
     * Complete OID4VP flow: parse request, select credentials, create presentation, submit
     */
    respondToPresentationRequest(requestUri: string, autoSelectCredentials?: boolean, userSelectedCredentialHashes?: string[]): Promise<{
        success: boolean;
        sessionId?: string;
        error?: string;
    }>;
    /**
     * Get presentation history and status
     */
    getPresentationHistory(): Promise<any[]>;
    /**
     * Preview what would be shared with verifier without actually submitting
     */
    previewPresentationForRequest(requestUri: string): Promise<{
        verifier: string;
        purpose: string;
        requiredCredentials: any[];
        matchingCredentials: SelectedCredential[];
    }>;
}
//# sourceMappingURL=oid4vp-client.d.ts.map