export declare class WalletService {
    private oid4vciClient;
    private oid4vpClient;
    private walletDID;
    private initialized;
    constructor();
    /**
     * Initialize the wallet service
     */
    initialize(): Promise<void>;
    /**
     * Check if wallet is initialized
     */
    private ensureInitialized;
    /**
     * Receive credential from issuer using OID4VCI
     */
    receiveCredential(offerUri: string, userPin?: string, issuerBaseUrl?: string): Promise<{
        credentialId: string;
        credential: any;
    }>;
    /**
     * Get all stored credentials
     */
    getStoredCredentials(type?: string): Promise<any[]>;
    /**
     * Preview presentation request without submitting
     */
    previewPresentationRequest(requestUri: string): Promise<any>;
    /**
     * Respond to presentation request from verifier
     */
    respondToPresentationRequest(requestUri: string, autoSelect?: boolean, selectedCredentialHashes?: string[]): Promise<{
        success: boolean;
        sessionId?: string;
        error?: string;
    }>;
    /**
     * Get comprehensive wallet status
     */
    getWalletStatus(): Promise<any>;
    /**
     * Complete SSI flow demonstration: receive credential then present it
     */
    demonstrateCompleteSSIFlow(credentialOfferUri: string, presentationRequestUri: string, userPin?: string, issuerBaseUrl?: string): Promise<{
        credential_receipt: any;
        presentation_result: any;
    }>;
    /**
     * Health check for wallet service
     */
    healthCheck(): Promise<{
        status: string;
        wallet_did: string | null;
        initialized: boolean;
        timestamp: string;
    }>;
    get walletDid(): string | null;
    get isInitialized(): boolean;
}
//# sourceMappingURL=wallet-service.d.ts.map