# SSI Wallet Service

A complete Self-Sovereign Identity (SSI) wallet implementation that supports both **OID4VCI** (credential issuance) and **OID4VP** (credential presentation) with **Proof of Possession (PoP)**.

## Features

### 🎯 **Complete SSI Ecosystem Support**
- **Issuer Integration**: Receive credentials via OpenID4VCI
- **Verifier Integration**: Present credentials via OpenID4VP
- **Holder Control**: Full wallet functionality with cryptographic PoP

### 🔐 **Security Features**
- **Proof of Possession (PoP)**: All requests signed with wallet's private key
- **DID-based Identity**: Each wallet has its own decentralized identifier
- **Cryptographic Verification**: All credentials and presentations cryptographically verified
- **Nonce Management**: Replay attack protection

### 💾 **Storage & Management**
- **Credential Storage**: Secure local storage using Veramo data store
- **Metadata Tracking**: Track credential source, issuance date, issuer info
- **Query Support**: Filter credentials by type, issuer, or other criteria

## Architecture

```
┌─────────────────┐    OID4VCI     ┌─────────────────┐    OID4VP     ┌─────────────────┐
│                 │   (Issuance)   │                 │ (Presentation)│                 │
│     ISSUER      │───────────────▶│     WALLET      │──────────────▶│    VERIFIER     │
│                 │                │                 │               │                 │
│ • Create Offers │                │ • Store Creds   │               │ • Request Proof │
│ • Issue VCs     │                │ • Manage Keys   │               │ • Verify VPs    │
│ • Verify PoP    │                │ • Create VPs    │               │ • Validate PoP  │
└─────────────────┘                │ • Sign with PoP │               └─────────────────┘
                                   └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd wallet-service
npm install
```

### 2. Start the Wallet Service

```bash
# Development mode
npm run dev

# Or build and start
npm run build
npm start
```

The wallet service will run on `http://localhost:9000`

### 3. Test the Complete Flow

```bash
# Make sure issuer/verifier is running on port 8000
cd ../Issuer-Admin/backend-issuer-verifier
npm run dev

# In another terminal, run the complete integration test
cd ..
./scripts/complete-ssi-flow.sh
```

## API Endpoints

### Health & Status
- `GET /health` - Service health check
- `GET /status` - Wallet status and credential summary
- `GET /wallet-did` - Get wallet's DID

### OID4VCI (Credential Issuance)
- `POST /receive-credential` - Receive credential from issuer
- `GET /credentials` - List stored credentials

### OID4VP (Credential Presentation)
- `POST /preview-presentation` - Preview presentation request
- `POST /present-credentials` - Present credentials to verifier

### Complete Flow
- `POST /complete-ssi-flow` - Execute full issue→store→present flow

## Usage Examples

### Receive Credential from Issuer

```bash
curl -X POST http://localhost:9000/receive-credential \
  -H "Content-Type: application/json" \
  -d '{
    "offer_uri": "openid-credential-offer://?credential_offer=...",
    "user_pin": "1234",
    "issuer_base_url": "http://localhost:8000"
  }'
```

### Present Credentials to Verifier

```bash
curl -X POST http://localhost:9000/present-credentials \
  -H "Content-Type: application/json" \
  -d '{
    "request_uri": "openid4vp://?client_id=verifier&request_uri=...",
    "auto_select": true
  }'
```

### Complete SSI Flow

```bash
curl -X POST http://localhost:9000/complete-ssi-flow \
  -H "Content-Type: application/json" \
  -d '{
    "credential_offer_uri": "openid-credential-offer://...",
    "presentation_request_uri": "openid4vp://...",
    "user_pin": "1234"
  }'
```

## Proof of Possession (PoP) Implementation

### OID4VCI PoP
When receiving credentials, the wallet:

1. **Creates PoP JWT** signed with wallet's private key
2. **Includes nonce** from credential issuer for replay protection
3. **Proves key ownership** to the issuer before credential issuance
4. **Receives credential** only after successful PoP verification

```typescript
const popPayload = {
  iss: walletDID,        // Wallet's DID
  aud: credentialEndpoint, // Issuer's endpoint
  iat: Math.floor(Date.now() / 1000),
  nonce: c_nonce,        // From issuer
  jti: nanoid(),         // Unique identifier
}

const popJWT = await agent.keyManagerSignJWT({
  kid: walletKeyId,
  payload: popPayload,
})
```

### OID4VP PoP
When presenting credentials, the wallet:

1. **Creates VP JWT** signed with wallet's private key
2. **Includes verifier's nonce** for challenge-response authentication
3. **Proves holder ownership** of the credentials being presented
4. **Embeds credentials** in a cryptographically signed presentation

```typescript
const vpPayload = {
  iss: walletDID,           // Holder/Wallet DID
  aud: verifierClientId,    // Verifier's client ID
  nonce: verifierNonce,     // From verifier
  vp: {
    type: ['VerifiablePresentation'],
    holder: walletDID,
    verifiableCredential: selectedCredentials,
  },
}

const vpJWT = await agent.keyManagerSignJWT({
  kid: walletKeyId,
  payload: vpPayload,
})
```

## Integration with Existing Systems

### With Your OID4VCI Issuer
```bash
# 1. Create credential offer using existing issuer
./scripts/oid4vci-enhanced.sh

# 2. Wallet receives the credential
curl -X POST http://localhost:9000/receive-credential \
  -d '{"offer_uri": "<offer_uri_from_step_1>"}'
```

### With Your OID4VP Verifier
```bash
# 1. Create presentation request using existing verifier
./scripts/oid4vp-verifier.sh

# 2. Wallet responds to the request
curl -X POST http://localhost:9000/present-credentials \
  -d '{"request_uri": "<request_uri_from_step_1>"}'
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
# Full ecosystem test
./scripts/complete-ssi-flow.sh

# Direct wallet API test
./scripts/complete-ssi-flow.sh --direct
```

### Manual Testing
```bash
# Check wallet status
curl http://localhost:9000/status

# List stored credentials
curl http://localhost:9000/credentials

# Health check
curl http://localhost:9000/health
```

## Database

The wallet uses SQLite with Veramo's data store for:
- **DID Storage**: Wallet's decentralized identifiers
- **Key Management**: Private/public key pairs
- **Credential Storage**: Received verifiable credentials
- **Metadata**: Issuance dates, issuer info, etc.

Database file: `./database/wallet.sqlite`

## Security Considerations

### Key Management
- Private keys stored encrypted with `SecretBox`
- Each wallet has unique DID and key pair
- Keys never transmitted, only used for local signing

### Network Security
- All API calls use HTTPS in production
- Credential offers validated before processing
- Presentation requests verified before responding

### Data Protection
- Minimal data retention (configurable)
- Credentials stored locally, not in cloud
- User consent required for presentations

## Production Deployment

### Environment Variables
```bash
# Security
SECRET_KEY=your-secret-key-here

# Network
PORT=9000
ISSUER_BASE_URL=https://issuer.example.com
VERIFIER_BASE_URL=https://verifier.example.com

# Database
DATABASE_PATH=./data/wallet.sqlite
```

### Docker Deployment
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
EXPOSE 9000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **"Wallet not initialized"**
   - Solution: Restart the service, DID will be created automatically

2. **"No matching credentials"**
   - Solution: Ensure wallet has received credentials that match verifier requirements

3. **"PoP verification failed"**
   - Solution: Check wallet DID and key management, ensure proper signing

4. **"Connection refused"**
   - Solution: Ensure issuer (port 8000) and wallet (port 9000) services are running

### Debug Commands
```bash
# Check all services
curl http://localhost:8000/api/debug/routes  # Issuer/Verifier
curl http://localhost:9000/health           # Wallet

# Detailed wallet status
curl http://localhost:9000/status | jq '.'

# List credentials with details
curl http://localhost:9000/credentials | jq '.credentials'
```

## Standards Compliance

This wallet implements:

- **OpenID4VCI** - OpenID for Verifiable Credential Issuance
- **OpenID4VP** - OpenID for Verifiable Presentations
- **DIF Presentation Exchange** - Credential requirement definitions
- **W3C Verifiable Credentials** - Standard credential format
- **DID Core** - Decentralized identifier standard
- **JWT-VC** - JSON Web Token based verifiable credentials

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Run tests: `npm test`
4. Commit changes: `git commit -am 'Add new feature'`
5. Push to branch: `git push origin feature/new-feature`
6. Submit pull request

## License

MIT License - see LICENSE file for details.

---

🎉 **Complete SSI Ecosystem**: This wallet completes your SSI implementation with full **Issuer → Wallet → Verifier** flow including cryptographic Proof of Possession!