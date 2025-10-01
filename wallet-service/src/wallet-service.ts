import { OID4VCIWalletClient } from './oid4vci-client.js'
import { OID4VPWalletClient } from './oid4vp-client.js'
import { ensureWalletDID } from './agent.js'

export class WalletService {
  private oid4vciClient: OID4VCIWalletClient
  private oid4vpClient: OID4VPWalletClient
  private walletDID: string | null = null
  private initialized = false

  constructor() {
    this.oid4vciClient = new OID4VCIWalletClient()
    this.oid4vpClient = new OID4VPWalletClient()
  }

  /**
   * Initialize the wallet service
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Wallet Service...')

    try {
      // Ensure wallet has a DID
      this.walletDID = await ensureWalletDID()

      // Initialize sub-clients
      await this.oid4vciClient.initialize()
      await this.oid4vpClient.initialize(this.walletDID)

      this.initialized = true
      console.log('✅ Wallet Service initialized successfully!')
      console.log(`🆔 Wallet DID: ${this.walletDID}`)
    } catch (error) {
      console.error('❌ Failed to initialize Wallet Service:', error)
      throw error
    }
  }

  /**
   * Check if wallet is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Wallet service not initialized. Call initialize() first.')
    }
  }

  // ========== OID4VCI METHODS ==========

  /**
   * Receive credential from issuer using OID4VCI
   */
  async receiveCredential(
    offerUri: string,
    userPin?: string,
    issuerBaseUrl?: string
  ): Promise<{ credentialId: string; credential: any }> {
    this.ensureInitialized()
    return this.oid4vciClient.receiveCredentialFromOffer(offerUri, userPin, issuerBaseUrl)
  }

  /**
   * Get all stored credentials
   */
  async getStoredCredentials(type?: string): Promise<any[]> {
    this.ensureInitialized()
    return this.oid4vciClient.getStoredCredentials(type)
  }

  // ========== OID4VP METHODS ==========

  /**
   * Preview presentation request without submitting
   */
  async previewPresentationRequest(requestUri: string): Promise<any> {
    this.ensureInitialized()
    return this.oid4vpClient.previewPresentationForRequest(requestUri)
  }

  /**
   * Respond to presentation request from verifier
   */
  async respondToPresentationRequest(
    requestUri: string,
    autoSelect = true,
    selectedCredentialHashes?: string[]
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    this.ensureInitialized()
    return this.oid4vpClient.respondToPresentationRequest(
      requestUri,
      autoSelect,
      selectedCredentialHashes
    )
  }

  // ========== WALLET STATUS AND UTILITIES ==========

  /**
   * Get comprehensive wallet status
   */
  async getWalletStatus(): Promise<any> {
    this.ensureInitialized()

    const oid4vciStatus = await this.oid4vciClient.getWalletStatus()
    const presentationHistory = await this.oid4vpClient.getPresentationHistory()

    return {
      ...oid4vciStatus,
      presentation_history: presentationHistory,
      services: {
        oid4vci: 'ready',
        oid4vp: 'ready',
      },
      initialized_at: new Date().toISOString(),
    }
  }

  /**
   * Complete SSI flow demonstration: receive credential then present it
   */
  async demonstrateCompleteSSIFlow(
    credentialOfferUri: string,
    presentationRequestUri: string,
    userPin?: string,
    issuerBaseUrl?: string
  ): Promise<{
    credential_receipt: any
    presentation_result: any
  }> {
    console.log('🎭 Starting complete SSI flow demonstration...')

    try {
      // Step 1: Receive credential from issuer
      console.log('📥 Step 1: Receiving credential from issuer...')
      const credentialReceipt = await this.receiveCredential(
        credentialOfferUri,
        userPin,
        issuerBaseUrl
      )

      // Small delay to ensure credential is stored
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Step 2: Present credential to verifier
      console.log('📤 Step 2: Presenting credential to verifier...')
      const presentationResult = await this.respondToPresentationRequest(presentationRequestUri)

      console.log('🎉 Complete SSI flow completed successfully!')

      return {
        credential_receipt: credentialReceipt,
        presentation_result: presentationResult,
      }
    } catch (error) {
      console.error('❌ Complete SSI flow failed:', error)
      throw error
    }
  }

  /**
   * Health check for wallet service
   */
  async healthCheck(): Promise<{
    status: string
    wallet_did: string | null
    initialized: boolean
    timestamp: string
  }> {
    return {
      status: this.initialized ? 'healthy' : 'not initialized',
      wallet_did: this.walletDID,
      initialized: this.initialized,
      timestamp: new Date().toISOString(),
    }
  }

  // ========== GETTERS ==========

  get walletDid(): string | null {
    return this.walletDID
  }

  get isInitialized(): boolean {
    return this.initialized
  }
}