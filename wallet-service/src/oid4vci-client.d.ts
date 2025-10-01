export interface CredentialOffer {
    credential_issuer: string;
    credential_configuration_ids: string[];
    grants?: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code'?: {
            'pre-authorized_code': string;
            user_pin_required?: boolean;
        };
    };
}
export interface CredentialResponse {
    credential: string | object;
    c_nonce?: string;
    c_nonce_expires_in?: number;
}
export declare class OID4VCIWalletClient {
    private walletDID;
    private storedCredentials;
    initialize(): Promise<void>;
    /**
     * Parse credential offer from URI or JSON
     */
    parseCredentialOffer(offerUri: string): Promise<CredentialOffer>;
    /**
     * Create Proof of Possession (PoP) JWT for credential request
     */
    createProofOfPossession(audience: string, nonce?: string, accessToken?: string): Promise<string>;
    /**
     * Exchange authorization code or pre-authorized code for access token
     */
    getAccessToken(tokenEndpoint: string, preAuthorizedCode?: string, userPin?: string): Promise<{
        access_token: string;
        c_nonce?: string;
        c_nonce_expires_in?: number;
    }>;
    /**
     * Request credential from issuer using access token and PoP
     */
    requestCredential(credentialEndpoint: string, accessToken: string, credentialConfigurationId: string, nonce?: string): Promise<CredentialResponse>;
    /**
     * Store credential in wallet
     */
    storeCredential(credential: string | object, metadata?: any): Promise<string>;
    /**
     * Get stored credentials (optionally filtered by type)
     */
    getStoredCredentials(type?: string): Promise<any[]>;
    /**
     * Complete OID4VCI flow: receive offer, get token, request credential, store it
     */
    receiveCredentialFromOffer(offerUri: string, userPin?: string, issuerBaseUrl?: string): Promise<{
        credentialId: string;
        credential: any;
    }>;
    /**
     * Get wallet status and stored credentials summary
     */
    getWalletStatus(): Promise<any>;
}
//# sourceMappingURL=oid4vci-client.d.ts.map