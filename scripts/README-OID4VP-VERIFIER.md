# OpenID4VP Verifier Scripts

This directory contains scripts for demonstrating and testing the OpenID4VP (OpenID for Verifiable Presentations) verification flow.

## Overview

The OID4VP verifier implements the complete presentation verification workflow:

1. **Create Presentation Definition** - Define what credentials/data you want to verify
2. **Generate Presentation Request** - Create a request with specific requirements
3. **Monitor for Responses** - Wait for wallets to respond with presentations
4. **Verify Presentations** - Validate the received credentials and presentations
5. **Display Results** - Show verification results and credential details

## Scripts

### `oid4vp-verifier.sh`

The main OID4VP verification demonstration script.

**Basic Usage:**
```bash
# Run the complete verification flow
./scripts/oid4vp-verifier.sh

# Run in demo mode (with simulated responses)
./scripts/oid4vp-verifier.sh --demo

# Check verifier status
./scripts/oid4vp-verifier.sh --status

# Monitor for verification results only
./scripts/oid4vp-verifier.sh --monitor-only

# Show help
./scripts/oid4vp-verifier.sh --help
```

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Server base URL | `http://localhost:8000` |
| `CREDENTIAL_TYPES` | Comma-separated credential types to request | `VerifiableCredential,EmployeeBadge` |
| `REQUIRED_FIELDS` | Comma-separated required fields | `name,department` |
| `TRUSTED_ISSUERS` | Comma-separated trusted issuer DIDs | `""` (empty) |
| `VERIFICATION_PURPOSE` | Purpose of verification | `"Please provide your employee credentials for workplace access verification"` |
| `CLIENT_ID` | Verifier client identifier | `oid4vp-verifier-demo` |

**Examples:**

```bash
# Request specific credential types
CREDENTIAL_TYPES="DrivingLicense,IdentityCard" ./scripts/oid4vp-verifier.sh

# Request credentials with specific fields
REQUIRED_FIELDS="name,birthDate,licenseNumber" ./scripts/oid4vp-verifier.sh

# Use custom purpose
VERIFICATION_PURPOSE="Age verification for alcohol purchase" ./scripts/oid4vp-verifier.sh

# Specify trusted issuers
TRUSTED_ISSUERS="did:web:issuer1.com,did:key:z6Mkv58..." ./scripts/oid4vp-verifier.sh

# Run against different server
BASE_URL="http://staging.example.com" ./scripts/oid4vp-verifier.sh
```

## Workflow Steps

### 1. Prerequisites

Before running the scripts, ensure:

1. **Server is running:**
   ```bash
   cd Issuer-Admin/backend-issuer-verifier
   npm run dev
   ```

2. **Dependencies installed:**
   ```bash
   # For the scripts (curl and jq)
   brew install curl jq  # macOS
   # or
   apt-get install curl jq  # Ubuntu/Debian
   ```

### 2. Create Presentation Definition

The script first creates a presentation definition that specifies:
- What types of credentials are required
- Which fields must be present in the credentials
- Optional: trusted issuers (DIDs that must have issued the credentials)
- Purpose of the verification request

### 3. Generate Presentation Request

A presentation request is created with:
- Unique request ID
- OpenID4VP URI (for QR codes)
- Direct request URL (for testing)
- Nonce for replay protection
- State for request correlation

### 4. Share Request with Holder

The generated request URI can be:
- Encoded as a QR code for mobile wallet scanning
- Sent as a deep link to wallet applications
- Used directly for testing purposes

**Sample Request URI:**
```
openid4vp://?client_id=oid4vp-verifier-demo&request_uri=http://localhost:8000/api/oid4vp/request/abc123
```

### 5. Wallet Responds

When a wallet receives the request, it:
1. Fetches the presentation definition
2. Prompts user to select matching credentials
3. Creates a verifiable presentation
4. Sends the presentation to the response endpoint

### 6. Verification Results

The verifier validates:
- Presentation signature and format
- Nonce and state correlation
- Each embedded credential's signature
- Credential field requirements
- Issuer trust (if specified)

## API Endpoints

The verifier exposes these OID4VP endpoints:

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/oid4vp/presentation-request` | POST | Create new presentation request |
| `/api/oid4vp/request/{id}` | GET | Get presentation request details |
| `/api/oid4vp/presentation-response` | POST | Receive presentation from wallet |
| `/api/oid4vp/session/{id}` | GET | Get verification session results |
| `/api/oid4vp/create-presentation-definition` | POST | Create custom presentation definition |
| `/api/oid4vp/requests` | GET | List active presentation requests |
| `/api/oid4vp/sessions` | GET | List verification sessions |
| `/api/oid4vp/health` | GET | Check verifier health |

## Testing with the Web UI

You can also test the verifier using the web interface:

1. Start the backend server:
   ```bash
   cd Issuer-Admin/backend-issuer-verifier
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd Issuer-Admin/frontend-issuer-verifer
   npm run dev
   ```

3. Navigate to: http://localhost:5173/verify

4. Choose "OID4VP Verifier" tab

5. Create presentation requests and monitor results

## Integration with Wallets

For real-world usage, wallets need to:

1. **Support OID4VP protocol** - Handle `openid4vp://` URIs
2. **Parse presentation definitions** - Understand DIF Presentation Exchange format
3. **Create verifiable presentations** - Sign presentations with holder's keys
4. **Submit to response endpoint** - POST presentations to callback URL

Popular wallets supporting OID4VP:
- SpruceID Wallet
- Microsoft Authenticator
- Trinsic Wallet
- Custom wallet implementations using libraries like:
  - `@sphereon/oid4vp-client` (TypeScript)
  - `veramo-core` (Node.js)
  - Custom implementations

## Security Considerations

1. **Nonce Usage** - Each request uses a unique nonce to prevent replay attacks
2. **State Management** - State parameter correlates requests and responses
3. **HTTPS Required** - Production deployments should use HTTPS
4. **Trusted Issuers** - Verify credentials only from known/trusted issuers
5. **Expiration** - Presentation requests and sessions have expiration times
6. **Data Minimization** - Only request necessary credential fields

## Troubleshooting

**Common Issues:**

1. **Server not running:**
   ```bash
   ./scripts/oid4vp-verifier.sh --status
   # Should show healthy status
   ```

2. **No verification responses:**
   - Check if wallet supports OID4VP
   - Verify the request URI format
   - Test with demo mode: `./scripts/oid4vp-verifier.sh --demo`

3. **JSON parsing errors:**
   - Install jq: `brew install jq`
   - Check API responses manually with curl

4. **Network issues:**
   - Verify BASE_URL is correct
   - Check firewall settings
   - Test API endpoints directly

**Debugging:**

```bash
# Enable verbose curl output
export CURL_VERBOSE=1
./scripts/oid4vp-verifier.sh --demo

# Check server logs
cd Issuer-Admin/backend-issuer-verifier
npm run dev  # Check console output

# Test individual API endpoints
curl -X GET http://localhost:8000/api/oid4vp/health
curl -X GET http://localhost:8000/api/oid4vp/requests
```

## Advanced Usage

### Custom Presentation Definitions

Create complex verification requirements:

```bash
# Request multiple credential types with specific fields
CREDENTIAL_TYPES="IdentityCard,DrivingLicense" \
REQUIRED_FIELDS="fullName,dateOfBirth,licenseClass" \
TRUSTED_ISSUERS="did:web:dmv.gov,did:web:identitybureau.gov" \
./scripts/oid4vp-verifier.sh
```

### Batch Verification

Monitor multiple verification sessions:

```bash
# Create multiple requests
for i in {1..3}; do
  VERIFICATION_PURPOSE="Verification session $i" ./scripts/oid4vp-verifier.sh &
  sleep 2
done

# Monitor all sessions
./scripts/oid4vp-verifier.sh --monitor-only
```

### Integration Testing

Test the complete flow:

```bash
# Terminal 1: Start verifier
./scripts/oid4vp-verifier.sh

# Terminal 2: Simulate wallet response (in demo mode)
./scripts/oid4vp-verifier.sh --demo

# Terminal 3: Monitor results
./scripts/oid4vp-verifier.sh --monitor-only
```

This script provides a complete implementation of the OpenID4VP verifier flow, similar to your existing OID4VCI issuer script, with comprehensive error handling, monitoring, and testing capabilities.