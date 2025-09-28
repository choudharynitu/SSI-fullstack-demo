# OpenID4VCI Flow Scripts

This directory contains scripts to demonstrate the complete OpenID4VCI (OpenID for Verifiable Credential Issuance) flow as outlined in your example.

## Scripts Overview

### 1. `oid4vci-enhanced.sh` - Production-Ready Script
Enhanced version with comprehensive error handling, validation, and configuration options.

### 2. `pop-jwt-generator.js` - JWT Utility
Node.js utility for generating proper Ed25519 Proof of Possession JWTs.

## Prerequisites

```bash
# Install required dependencies
# On macOS:
brew install jq node

# On Ubuntu/Debian:
sudo apt install jq nodejs npm

# On RHEL/CentOS:
sudo yum install jq nodejs npm
```

## Quick Start

### 1. Start the Backend
```bash
cd Issuer-Admin/backend-issuer-verifier
npm install
npm run dev
```

### 2. Run the Enhanced Script
```bash
./oid4vci-enhanced.sh
```

## Configuration Options

### Environment Variables
```bash
export BASE_URL="http://localhost:8000"
export SCHEMA_ID="EmployeeBadge"
export USER_PIN="1234"
export HOLDER_NAME="Nitu"
export DEPARTMENT="IT"
export DESIGNATION="CTO"
```

### Command Line Options (Enhanced Script)
```bash
./oid4vci-enhanced.sh --help

Options:
  -u, --url URL          Backend URL (default: http://localhost:8000)
  -s, --schema SCHEMA    Schema ID (default: EmployeeBadge)
  -p, --pin PIN          User PIN (default: 1234)
  -n, --name NAME        Holder name (default: Nitu)
  -d, --department DEPT  Department (default: IT)
  --designation DESIG    Designation (default: CTO)
  -v, --verbose          Verbose output
  -h, --help             Show help
```

### Example Usage
```bash
# Custom configuration
./oid4vci-enhanced.sh -n "John Doe" -d "Engineering" --designation "Developer" -p "5678"

# Different backend URL
./oid4vci-enhanced.sh -u "https://your-issuer.com"

# Verbose mode for debugging
./oid4vci-enhanced.sh -v
```

## The 5-Step Flow

### Step 1: Create Credential Offer
- Issuer admin creates a credential offer with schema and claims
- Returns offer ID and credential offer URI
- This URI would typically be embedded in a QR code

### Step 2: Retrieve Offer Details
- Holder (wallet) retrieves the credential offer details
- Gets pre-authorized code and PIN requirements
- Simulates QR code scanning or button click

### Step 3: Exchange Code for Token
- Wallet exchanges pre-authorized code + PIN for access token
- Receives access token and c_nonce for proof generation

### Step 4: Create Proof of Possession
- Wallet generates Ed25519 key pair and DID:key
- Creates JWT proof of possession using c_nonce
- Demonstrates holder controls their private key

### Step 5: Request Credential
- Wallet requests the verifiable credential
- Provides PoP JWT and credential subject DID
- Receives the issued verifiable credential

## Security Features

### JWT Generation (`pop-jwt-generator.js`)
- Proper Ed25519 key pair generation
- Correct DID:key formatting with multicodec prefixes
- Standards-compliant JWT creation with JOSE
- Nonce-based replay protection

### Error Handling (Enhanced Script)
- HTTP status code validation
- JSON response validation
- Dependency checking
- Backend availability verification
- Comprehensive logging and debugging

## Output Example

```bash
=== STEP 1: Creating credential offer ===
✅ Credential offer created successfully
📋 Offer ID: tCFgxoK3K8AElRTbnHViE
📋 Credential Offer URI: http://localhost:8000/api/oid4vci/credential-offer?offer_id=tCFgxoK3K8AElRTbnHViE

=== STEP 2: Retrieving credential offer details ===
✅ Credential offer retrieved successfully
📋 Pre-authorized code: 4vNFt58509qSX0xJCeQTJ...
📋 User PIN required: true

=== STEP 3: Exchanging pre-authorized code for access token ===
✅ Access token obtained successfully
📋 Access Token: JrmF-jDWaf70tDfuk8yD...
📋 C_nonce: 0xUMkFkjL8L7Eh301v7RIDDi
📋 Expires in: 300 seconds

=== STEP 4: Creating Proof of Possession JWT ===
✅ PoP JWT created using local generator
📋 Holder DID: did:key:z6Mkkmt9p4V94pE9RoHdp2knDiDYeu5oM6S9E69a3BixMUuA
📋 PoP JWT: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpc3Mi...

=== STEP 5: Requesting verifiable credential ===
✅ Verifiable credential issued successfully!
📋 Issuer DID: did:key:z6MkrTXaKMJhiviz3gLJGvkqfj4C8R3pVg5uFg4iWDtZc5xe
📋 Credential Type: EmployeeBadge
📋 Issuance Date: 2025-09-28T07:57:25.000Z
📋 Subject DID: did:key:z6Mkkmt9p4V94pE9RoHdp2knDiDYeu5oM6S9E69a3BixMUuA

🎉 OpenID4VCI flow completed successfully!
```

## Troubleshooting

### Common Issues

1. **Backend not running**
   ```
   ❌ Backend server is not running at http://localhost:8000
   📋 Please start the backend with: cd Issuer-Admin/backend-issuer-verifier && npm run dev
   ```

2. **Missing dependencies**
   ```
   ❌ Missing required dependencies: jq node
   📋 Please install the missing dependencies and try again.
   ```

3. **JWT generation fails**
   - The script falls back to a test JWT if Node.js crypto fails
   - Check Node.js version (requires v15+ for Ed25519 support)

### Debug Mode
```bash
# Enable verbose output
./oid4vci-enhanced.sh -v

# Check specific step manually
curl -s "http://localhost:8000/api/oid4vci/credential-offer?offer_id=YOUR_OFFER_ID" | jq .
```

## Integration Notes

These scripts demonstrate the complete OpenID4VCI flow and can be:
- Modified for different credential schemas
- Integrated into wallet applications
- Used for testing and development
- Extended for production scenarios with additional security

The generated credentials are fully compliant W3C Verifiable Credentials that can be stored in any compatible wallet implementation.
