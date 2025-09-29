# OID4VP Protocol Testing Guide

## Overview
This guide shows how to test the complete OpenID4VP (OpenID for Verifiable Presentations) protocol implementation.

## Testing Methods

### 1. Quick Script Testing
```bash
# Basic test with default parameters
./scripts/oid4vp-verifier.sh --demo

# Custom credential requirements
CREDENTIAL_TYPES="DrivingLicense,IdentityCard" \
REQUIRED_FIELDS="name,birthDate" \
./scripts/oid4vp-verifier.sh

# Monitor status
./scripts/oid4vp-verifier.sh --status
```

### 2. Complete Protocol Testing
```bash
# Test the full OID4VP flow step by step
./scripts/test-oid4vp-protocol.sh
```

### 3. Web Interface Testing
1. Start frontend: `cd Issuer-Admin/frontend-issuer-verifer && npm run dev`
2. Navigate to: http://localhost:5173/verify
3. Choose "OID4VP Verifier" tab
4. Create and monitor presentation requests

### 4. Manual API Testing

#### Step 1: Create Presentation Definition
```bash
curl -X POST http://localhost:8000/api/oid4vp/create-presentation-definition \
  -H "Content-Type: application/json" \
  -d '{
    "credential_types": ["VerifiableCredential", "EmployeeBadge"],
    "required_fields": ["name", "department"],
    "purpose": "Employee verification"
  }'
```

#### Step 2: Create Presentation Request
```bash
curl -X POST http://localhost:8000/api/oid4vp/presentation-request \
  -H "Content-Type: application/json" \
  -d '{"client_id": "my-verifier"}'
```

#### Step 3: Monitor Requests
```bash
curl http://localhost:8000/api/oid4vp/requests
curl http://localhost:8000/api/oid4vp/sessions
curl http://localhost:8000/api/oid4vp/health
```

### 5. Real Wallet Integration Testing

For testing with actual mobile wallets:

#### Compatible Wallets:
- **SpruceID Wallet** - Supports OID4VP
- **Microsoft Authenticator** - Limited OID4VP support
- **Trinsic Wallet** - Full OID4VP support
- **Custom wallets** using libraries like `@sphereon/oid4vp-client`

#### Integration Steps:
1. Generate presentation request with script
2. Create QR code from the `request_uri`
3. Scan with compatible wallet
4. Wallet prompts user for credential selection
5. Wallet creates and sends verifiable presentation
6. Verifier validates and shows results

## Testing Scenarios

### Scenario 1: Employee Badge Verification
```bash
CREDENTIAL_TYPES="EmployeeBadge" \
REQUIRED_FIELDS="name,department,employeeId" \
VERIFICATION_PURPOSE="Workplace access control" \
./scripts/oid4vp-verifier.sh
```

### Scenario 2: Age Verification
```bash
CREDENTIAL_TYPES="DrivingLicense,IdentityCard" \
REQUIRED_FIELDS="name,birthDate" \
VERIFICATION_PURPOSE="Age verification for service access" \
./scripts/oid4vp-verifier.sh
```

### Scenario 3: Educational Credentials
```bash
CREDENTIAL_TYPES="UniversityDegree,Diploma" \
REQUIRED_FIELDS="name,degreeType,university" \
VERIFICATION_PURPOSE="Academic credential verification" \
./scripts/oid4vp-verifier.sh
```

### Scenario 4: Trusted Issuer Verification
```bash
CREDENTIAL_TYPES="VerifiableCredential" \
TRUSTED_ISSUERS="did:web:university.edu,did:key:z6Mk..." \
./scripts/oid4vp-verifier.sh
```

## Expected Results

### ✅ Successful Flow
1. **Request Creation**: Generates OpenID4VP URI
2. **Wallet Interaction**: Wallet fetches request successfully
3. **User Consent**: User approves credential sharing
4. **Presentation Creation**: Wallet creates signed VP
5. **Verification**: Verifier validates presentation and credentials
6. **Result**: Session shows `valid: true` with credential details

### ⚠️ Expected Failures
- **Invalid Credentials**: Malformed or expired credentials
- **Signature Verification**: Invalid signatures or untrusted keys
- **Missing Fields**: Credentials don't contain required fields
- **Untrusted Issuers**: Credentials from non-trusted issuers
- **Expired Requests**: Presentation requests past expiration time

## Protocol Validation Checklist

### Verifier Side (Our Implementation)
- ✅ Creates proper presentation definitions
- ✅ Generates valid OpenID4VP URIs
- ✅ Manages nonce and state correctly
- ✅ Validates presentation signatures
- ✅ Checks credential requirements
- ✅ Handles trusted issuer verification
- ✅ Manages session lifecycle

### Wallet Side (External)
- 🔲 Parses OpenID4VP URIs correctly
- 🔲 Fetches presentation requests
- 🔲 Prompts user for credential selection
- 🔲 Creates valid verifiable presentations
- 🔲 Signs presentations with holder key
- 🔲 Sends to correct callback URL
- 🔲 Handles error responses

## API Endpoints

| Endpoint | Method | Purpose |
|----------|---------|---------|
| `/api/oid4vp/health` | GET | Health check |
| `/api/oid4vp/create-presentation-definition` | POST | Create presentation requirements |
| `/api/oid4vp/presentation-request` | POST | Create new request |
| `/api/oid4vp/request/{id}` | GET | Get request details |
| `/api/oid4vp/presentation-response` | POST | Receive wallet response |
| `/api/oid4vp/session/{id}` | GET | Get verification results |
| `/api/oid4vp/requests` | GET | List active requests |
| `/api/oid4vp/sessions` | GET | List verification sessions |

## Troubleshooting

### Common Issues

1. **"Cannot resolve hostname"** - Check BASE_URL and server status
2. **"Invalid state parameter"** - State mismatch in demo mode (expected)
3. **"No DID resolver configured"** - Missing resolver for DID verification
4. **"Request expired"** - Presentation request past 15-minute timeout
5. **"Invalid signature"** - Credential or presentation signature verification failed

### Debug Commands
```bash
# Check server health
curl http://localhost:8000/api/oid4vp/health

# List all routes
curl http://localhost:8000/api/debug/routes

# Monitor active requests
./scripts/oid4vp-verifier.sh --status

# Check server logs
# (check console where you ran `npm run dev`)
```

## Security Considerations

1. **HTTPS Required** - Production must use HTTPS
2. **Nonce Validation** - Each request uses unique nonce
3. **State Management** - Proper correlation of requests/responses
4. **Signature Verification** - All credentials and presentations validated
5. **Expiration Checks** - Requests and sessions have time limits
6. **Trusted Issuers** - Optional whitelist of acceptable credential issuers

This implementation provides a complete, standards-compliant OpenID4VP verifier system ready for integration with compatible wallets and credential ecosystems.