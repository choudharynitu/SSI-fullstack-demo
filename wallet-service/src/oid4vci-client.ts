import { agent, ensureWalletDID } from './agent.js'
import { createJWT } from 'did-jwt'
import base64url from 'base64url'
import axios from 'axios'
import { nanoid } from 'nanoid'
import crypto from 'crypto'

export interface CredentialOffer {
  credential_issuer: string
  credential_configuration_ids: string[]
  grants?: {
    'urn:ietf:params:oauth:grant-type:pre-authorized_code'?: {
      'pre-authorized_code': string
      user_pin_required?: boolean
    }
  }
}

export interface CredentialResponse {
  credential: string | object
  c_nonce?: string
  c_nonce_expires_in?: number
}

export class OID4VCIWalletClient {
  private walletDID: string | null = null
  private storedCredentials = new Map<string, any>()

  async initialize(): Promise<void> {
    this.walletDID = await ensureWalletDID()
    console.log('🔧 OID4VCI Wallet Client initialized')
  }

  /**
   * Parse credential offer from URI or JSON
   */
  async parseCredentialOffer(offerUri: string): Promise<CredentialOffer> {
    try {
      // Handle direct HTTP URL to credential offer
      if (offerUri.startsWith('http://') || offerUri.startsWith('https://')) {
        console.log('🔍 Fetching credential offer from HTTP URL:', offerUri)
        const response = await axios.get(offerUri)
        if (response.status === 200) {
          return response.data
        }
        throw new Error(`Failed to fetch credential offer: ${response.statusText}`)
      }

      // Handle openid-credential-offer:// URI with parameters
      const url = new URL(offerUri.replace('openid-credential-offer://', 'https://'))
      const credentialOfferUri = url.searchParams.get('credential_offer_uri')
      const credentialOfferParam = url.searchParams.get('credential_offer')

      if (credentialOfferParam) {
        return JSON.parse(decodeURIComponent(credentialOfferParam))
      }

      if (credentialOfferUri) {
        // Fetch from the credential_offer_uri
        console.log('🔍 Fetching credential offer from credential_offer_uri:', credentialOfferUri)
        const response = await axios.get(credentialOfferUri)
        if (response.status === 200) {
          return response.data
        }
        throw new Error(`Failed to fetch credential offer from URI: ${response.statusText}`)
      }

      throw new Error('No valid credential offer found in URI')
    } catch (error) {
      console.error('Error parsing credential offer:', error)
      throw error
    }
  }

  /**
   * Create Proof of Possession (PoP) JWT for credential request
   */
  async createProofOfPossession(
    audience: string,
    nonce?: string,
    accessToken?: string
  ): Promise<string> {
    if (!this.walletDID) {
      throw new Error('Wallet not initialized')
    }

    const identifier = await agent.didManagerGetByAlias({ alias: 'wallet-main' })
    if (!identifier) {
      throw new Error('Wallet DID not found')
    }

    const keyId = identifier.keys[0]?.kid
    if (!keyId) {
      throw new Error('No key found for wallet DID')
    }

    // Create PoP JWT payload
    const popPayload = {
      iss: this.walletDID,
      sub: this.walletDID,
      aud: audience,
      iat: Math.floor(Date.now() / 1000),
      nonce: nonce,
      jti: nanoid(),
    }

    // Create PoP JWT using did-jwt with EdDSA algorithm for Ed25519 keys
    const popJWT = await createJWT(popPayload, {
      issuer: this.walletDID,
      alg: 'EdDSA',
      signer: async (data: string | Uint8Array) => {
        const dataToSign = typeof data === 'string' ? data : new TextDecoder().decode(data)
        const signature = await agent.keyManagerSign({
          keyRef: keyId,
          data: dataToSign,
        })

        // Return the signature as string (did-jwt handles the format internally)
        return signature
      }
    })

    console.log('🔐 Created PoP JWT for credential request')
    return popJWT
  }

  /**
   * Exchange authorization code or pre-authorized code for access token
   */
  async getAccessToken(
    tokenEndpoint: string,
    preAuthorizedCode?: string,
    userPin?: string
  ): Promise<{ access_token: string; c_nonce?: string; c_nonce_expires_in?: number }> {
    const tokenRequest = {
      grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
      'pre-authorized_code': preAuthorizedCode,
      user_pin: userPin,
    }

    const response = await axios.post(tokenEndpoint, tokenRequest, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status !== 200) {
      throw new Error(`Token request failed: ${response.statusText}`)
    }

    console.log('🎫 Access token obtained')
    return response.data
  }

  /**
   * Request credential from issuer using access token and PoP
   */
  async requestCredential(
    credentialEndpoint: string,
    accessToken: string,
    credentialConfigurationId: string,
    nonce?: string
  ): Promise<CredentialResponse> {
    if (!this.walletDID) {
      throw new Error('Wallet not initialized')
    }

    // Create proof of possession (use issuer base URL as audience, not credential endpoint)
    const issuerBaseUrl = credentialEndpoint.replace('/oid4vci/credential', '')
    const popJWT = await this.createProofOfPossession(issuerBaseUrl, nonce, accessToken)

    const credentialRequest = {
      format: 'jwt_vc',
      type: credentialConfigurationId,
      credential_subject: {
        id: this.walletDID,
      },
      proof: {
        proof_type: 'jwt',
        jwt: popJWT,
      },
    }

    const response = await axios.post(credentialEndpoint, credentialRequest, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.status !== 200) {
      throw new Error(`Credential request failed: ${response.statusText}`)
    }

    console.log('📜 Credential received from issuer')
    return response.data
  }

  /**
   * Store credential in wallet
   */
  async storeCredential(credential: string | object, metadata?: any): Promise<string> {
    const credentialId = nanoid()

    try {
      // Store in Veramo data store
      if (typeof credential === 'string') {
        // JWT credential - parse it first
        const parsedCredential = await agent.dataStoreSaveVerifiableCredential({
          verifiableCredential: credential as any
        })
      } else {
        // JSON-LD credential
        const parsedCredential = await agent.dataStoreSaveVerifiableCredential({
          verifiableCredential: credential as any
        })
      }

      // Also store in local map with metadata
      this.storedCredentials.set(credentialId, {
        credential,
        metadata: {
          ...metadata,
          stored_at: new Date().toISOString(),
          credential_id: credentialId,
        },
      })

      console.log(`💾 Credential stored with ID: ${credentialId}`)
      return credentialId
    } catch (error) {
      console.error('Error storing credential:', error)
      throw error
    }
  }

  /**
   * Get stored credentials (optionally filtered by type)
   */
  async getStoredCredentials(type?: string): Promise<any[]> {
    try {
      // Get from Veramo data store
      const credentials = await agent.dataStoreORMGetVerifiableCredentials()

      const result = credentials.map((cred) => ({
        credential: cred.verifiableCredential,
        hash: cred.hash,
        metadata: {
          stored_at: (cred as any).issuanceDate || new Date().toISOString(),
          issuer: typeof cred.verifiableCredential === 'string' ? 'JWT' : cred.verifiableCredential.issuer,
        },
      }))

      if (type) {
        return result.filter((cred) => {
          const credential = cred.credential
          if (typeof credential === 'string') {
            // For JWT, would need to decode and check
            return true // Simplified for now
          } else {
            return credential.type && credential.type.includes(type)
          }
        })
      }

      return result
    } catch (error) {
      console.error('Error retrieving credentials:', error)
      return []
    }
  }

  /**
   * Complete OID4VCI flow: receive offer, get token, request credential, store it
   */
  async receiveCredentialFromOffer(
    offerUri: string,
    userPin?: string,
    issuerBaseUrl = 'http://localhost:8000'
  ): Promise<{ credentialId: string; credential: any }> {
    console.log('🎯 Starting OID4VCI credential receipt flow...')

    try {
      // Parse the credential offer
      const offer = await this.parseCredentialOffer(offerUri)
      console.log('📨 Parsed credential offer:', JSON.stringify(offer, null, 2))

      // Get token endpoint (discover from issuer)
      const tokenEndpoint = `${issuerBaseUrl}/api/oid4vci/token`
      const credentialEndpoint = `${issuerBaseUrl}/api/oid4vci/credential`

      // Exchange pre-authorized code for access token
      const preAuthorizedCode = offer.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code']
      if (!preAuthorizedCode) {
        throw new Error('No pre-authorized code found in offer')
      }

      const tokenResponse = await this.getAccessToken(tokenEndpoint, preAuthorizedCode, userPin)

      // Request credential with PoP
      const credentialConfigurationId = offer.credential_configuration_ids[0]
      const credentialResponse = await this.requestCredential(
        credentialEndpoint,
        tokenResponse.access_token,
        credentialConfigurationId,
        tokenResponse.c_nonce
      )

      // Store the credential
      const credentialId = await this.storeCredential(credentialResponse.credential, {
        source: 'OID4VCI',
        offer_id: offer.credential_issuer,
        received_at: new Date().toISOString(),
      })

      console.log('✅ OID4VCI flow completed successfully!')

      return {
        credentialId,
        credential: credentialResponse.credential,
      }
    } catch (error) {
      console.error('❌ OID4VCI flow failed:', error)
      throw error
    }
  }

  /**
   * Get wallet status and stored credentials summary
   */
  async getWalletStatus(): Promise<any> {
    const credentials = await this.getStoredCredentials()

    return {
      wallet_did: this.walletDID,
      credentials_count: credentials.length,
      credentials: credentials.map((cred) => ({
        hash: cred.hash,
        issuer: cred.metadata.issuer,
        stored_at: cred.metadata.stored_at,
      })),
      initialized: !!this.walletDID,
    }
  }
}