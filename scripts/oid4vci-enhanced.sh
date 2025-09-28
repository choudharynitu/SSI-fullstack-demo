#!/bin/bash

# Enhanced OpenID4VCI Complete Flow Script with Better Error Handling
# This script demonstrates the complete credential issuance flow using OpenID4VCI protocol
# 

set -e  # Exit on any error

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
SCHEMA_ID="${SCHEMA_ID:-EmployeeBadge}"
USER_PIN="${USER_PIN:-1234}"
HOLDER_NAME="${HOLDER_NAME:-Nitu}"
DEPARTMENT="${DEPARTMENT:-IT}"
DESIGNATION="${DESIGNATION:-CTO}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
print_step() {
    echo -e "${BLUE}=== STEP $1: $2 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}📋 $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${PURPLE}⚠️  $1${NC}"
}

print_json() {
    echo -e "${PURPLE}$1${NC}"
    echo "$2" | jq . 2>/dev/null || echo "$2"
    echo
}

# Validation functions
check_dependencies() {
    local missing_deps=()

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_info "Please install the missing dependencies and try again."
        exit 1
    fi
}

check_backend() {
    print_info "Checking backend server availability..."

    if ! curl -s --max-time 5 "$BASE_URL/api" > /dev/null 2>&1; then
        print_error "Backend server is not running at $BASE_URL"
        print_info "Please start the backend with:"
        print_info "  cd Issuer-Admin/backend-issuer-verifier && npm run dev"
        exit 1
    fi

    print_success "Backend server is running"
}

validate_json_response() {
    local response="$1"
    local step="$2"

    if ! echo "$response" | jq . >/dev/null 2>&1; then
        print_error "Invalid JSON response in $step"
        print_info "Response: $response"
        exit 1
    fi

    # Check for error in response
    if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
        local error_msg=$(echo "$response" | jq -r '.error')
        print_error "$step failed: $error_msg"
        exit 1
    fi
}

# Main flow functions
create_credential_offer() {
    print_step "1" "Creating credential offer"

    local request_body="{
        \"schemaId\":\"$SCHEMA_ID\",
        \"claims\":{
            \"Name\":\"$HOLDER_NAME\",
            \"Department\":\"$DEPARTMENT\",
            \"Designation\":\"$DESIGNATION\"
        },
        \"userPin\":\"$USER_PIN\"
    }"

    print_info "Request payload:"
    echo "$request_body" | jq .

    OFFER_RESPONSE=$(curl -s --max-time 30 -X POST "$BASE_URL/api/offers" \
        -H 'content-type: application/json' \
        -H 'accept: application/json' \
        -d "$request_body")

    local http_code="200"  # Assume success if we get a response

    # Check if we got a valid JSON response with required fields
    if ! echo "$OFFER_RESPONSE" | jq -e '.id' >/dev/null 2>&1; then
        print_error "Failed to create credential offer - invalid response"
        print_info "Response: $OFFER_RESPONSE"
        exit 1
    fi

    validate_json_response "$OFFER_RESPONSE" "credential offer creation"

    OFFER_ID=$(echo "$OFFER_RESPONSE" | jq -r '.id // empty')
    CREDENTIAL_OFFER_URI=$(echo "$OFFER_RESPONSE" | jq -r '.credential_offer_uri // empty')

    if [ -z "$OFFER_ID" ] || [ -z "$CREDENTIAL_OFFER_URI" ]; then
        print_error "Missing required fields in offer response"
        print_json "Response:" "$OFFER_RESPONSE"
        exit 1
    fi

    print_success "Credential offer created successfully"
    print_info "Offer ID: $OFFER_ID"
    print_info "Credential Offer URI: $CREDENTIAL_OFFER_URI"
    print_json "Full response:" "$OFFER_RESPONSE"
}

retrieve_credential_offer() {
    print_step "2" "Retrieving credential offer details"

    OFFER_DETAILS=$(curl -s --max-time 30 "$CREDENTIAL_OFFER_URI")

    # Check if we got a valid JSON response
    if ! echo "$OFFER_DETAILS" | jq . >/dev/null 2>&1; then
        print_error "Failed to retrieve credential offer - invalid response"
        print_info "Response: $OFFER_DETAILS"
        exit 1
    fi

    validate_json_response "$OFFER_DETAILS" "credential offer retrieval"

    PRE_AUTH_CODE=$(echo "$OFFER_DETAILS" | jq -r '.grants["urn:ietf:params:oauth:grant-type:pre-authorized_code"]["pre-authorized_code"] // empty')
    USER_PIN_REQUIRED=$(echo "$OFFER_DETAILS" | jq -r '.grants["urn:ietf:params:oauth:grant-type:pre-authorized_code"]["user_pin_required"] // false')

    if [ -z "$PRE_AUTH_CODE" ]; then
        print_error "Missing pre-authorized code in offer details"
        print_json "Response:" "$OFFER_DETAILS"
        exit 1
    fi

    print_success "Credential offer retrieved successfully"
    print_info "Pre-authorized code: ${PRE_AUTH_CODE:0:20}..."
    print_info "User PIN required: $USER_PIN_REQUIRED"
    print_json "Full response:" "$OFFER_DETAILS"
}

exchange_code_for_token() {
    print_step "3" "Exchanging pre-authorized code for access token"

    local token_request="{
        \"grant_type\":\"urn:ietf:params:oauth:grant-type:pre-authorized_code\",
        \"pre-authorized_code\":\"$PRE_AUTH_CODE\"
    }"

    # Add user_pin if required
    if [ "$USER_PIN_REQUIRED" = "true" ]; then
        token_request=$(echo "$token_request" | jq --arg pin "$USER_PIN" '. + {"user_pin": $pin}')
        print_info "Including user PIN in token request"
    fi

    print_info "Token request:"
    echo "$token_request" | jq .

    TOKEN_RESPONSE=$(curl -s --max-time 30 -X POST "$BASE_URL/api/oid4vci/token" \
        -H 'content-type: application/json' \
        -H 'accept: application/json' \
        -d "$token_request")

    # Check if we got a valid JSON response
    if ! echo "$TOKEN_RESPONSE" | jq . >/dev/null 2>&1; then
        print_error "Failed to exchange code for token - invalid response"
        print_info "Response: $TOKEN_RESPONSE"
        exit 1
    fi

    validate_json_response "$TOKEN_RESPONSE" "token exchange"

    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
    C_NONCE=$(echo "$TOKEN_RESPONSE" | jq -r '.c_nonce // empty')
    EXPIRES_IN=$(echo "$TOKEN_RESPONSE" | jq -r '.expires_in // empty')

    if [ -z "$ACCESS_TOKEN" ] || [ -z "$C_NONCE" ]; then
        print_error "Missing required fields in token response"
        print_json "Response:" "$TOKEN_RESPONSE"
        exit 1
    fi

    print_success "Access token obtained successfully"
    print_info "Access Token: ${ACCESS_TOKEN:0:20}..."
    print_info "C_nonce: $C_NONCE"
    print_info "Expires in: $EXPIRES_IN seconds"
    print_json "Full response:" "$TOKEN_RESPONSE"
}

create_pop_jwt() {
    print_step "4" "Creating Proof of Possession JWT"

    # Check if our JWT generator exists
    if [ -f "./pop-jwt-generator.js" ]; then
        print_info "Using local JWT generator"

        POP_OUTPUT=$(C_NONCE="$C_NONCE" CRED_ISSUER="$BASE_URL/api" node ./pop-jwt-generator.js 2>/dev/null)

        if [ $? -eq 0 ] && [ -n "$POP_OUTPUT" ]; then
            DID=$(echo "$POP_OUTPUT" | grep "DID " | cut -d' ' -f2-)
            POP_JWT=$(echo "$POP_OUTPUT" | grep "POP_JWT " | cut -d' ' -f2-)

            if [ -n "$DID" ] && [ -n "$POP_JWT" ]; then
                print_success "PoP JWT created using local generator"
                print_info "Holder DID: $DID"
                print_info "PoP JWT: ${POP_JWT:0:50}..."
                return
            fi
        fi
    fi

    print_warning "Local JWT generator not available, using fallback method"

    # Fallback method using inline Node.js script
    cat > /tmp/fallback_pop.js << 'EOF'
const crypto = require('crypto');

function base64urlEscape(str) {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createFallbackJWT() {
    try {
        const cNonce = process.env.C_NONCE;
        const audience = process.env.CRED_ISSUER || 'http://localhost:8000/api';

        // Use a deterministic test key for demonstration
        const testDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

        const now = Math.floor(Date.now() / 1000);
        const header = { alg: 'EdDSA', typ: 'JWT' };
        const payload = {
            iss: testDid,
            sub: testDid,
            aud: audience,
            iat: now,
            nbf: now,
            exp: now + 300,
            nonce: cNonce,
            jti: crypto.randomUUID(),
            attestation: 'openid_credential'
        };

        const encodedHeader = base64urlEscape(Buffer.from(JSON.stringify(header)).toString('base64'));
        const encodedPayload = base64urlEscape(Buffer.from(JSON.stringify(payload)).toString('base64'));
        const jwt = `${encodedHeader}.${encodedPayload}.test_signature_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`DID ${testDid}`);
        console.log(`POP_JWT ${jwt}`);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

createFallbackJWT();
EOF

    POP_OUTPUT=$(C_NONCE="$C_NONCE" CRED_ISSUER="$BASE_URL/api" node /tmp/fallback_pop.js 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$POP_OUTPUT" ]; then
        print_error "Failed to create PoP JWT"
        rm -f /tmp/fallback_pop.js
        exit 1
    fi

    DID=$(echo "$POP_OUTPUT" | grep "DID " | cut -d' ' -f2-)
    POP_JWT=$(echo "$POP_OUTPUT" | grep "POP_JWT " | cut -d' ' -f2-)

    rm -f /tmp/fallback_pop.js

    print_success "PoP JWT created using fallback method"
    print_warning "Note: This uses a test signature for demonstration"
    print_info "Holder DID: $DID"
    print_info "PoP JWT: ${POP_JWT:0:50}..."
}

request_credential() {
    print_step "5" "Requesting verifiable credential"

    local credential_request="{
        \"type\":\"$SCHEMA_ID\",
        \"format\":\"jwt_vc\",
        \"proof\":{
            \"proof_type\":\"jwt\",
            \"jwt\":\"$POP_JWT\"
        },
        \"credential_subject\":{
            \"id\":\"$DID\"
        }
    }"

    print_info "Credential request:"
    echo "$credential_request" | jq .

    CREDENTIAL_RESPONSE=$(curl -s --max-time 30 -X POST "$BASE_URL/api/oid4vci/credential" \
        -H "authorization: Bearer $ACCESS_TOKEN" \
        -H "content-type: application/json" \
        -H "accept: application/json" \
        -d "$credential_request")

    # Check if we got a valid JSON response
    if ! echo "$CREDENTIAL_RESPONSE" | jq . >/dev/null 2>&1; then
        print_error "Failed to request credential - invalid response"
        print_info "Response: $CREDENTIAL_RESPONSE"
        exit 1
    fi

    validate_json_response "$CREDENTIAL_RESPONSE" "credential request"

    # Check if credential was successfully issued
    if echo "$CREDENTIAL_RESPONSE" | jq -e '.credential' > /dev/null; then
        print_success "Verifiable credential issued successfully!"

        # Extract and display key information
        local issuer_did=$(echo "$CREDENTIAL_RESPONSE" | jq -r '.credential.issuer.id // .credential.issuer // "N/A"')
        local credential_type=$(echo "$CREDENTIAL_RESPONSE" | jq -r '.credential.type[1] // .credential.type // "N/A"')
        local issuance_date=$(echo "$CREDENTIAL_RESPONSE" | jq -r '.credential.issuanceDate // "N/A"')

        print_info "=== Credential Summary ==="
        print_info "Issuer DID: $issuer_did"
        print_info "Credential Type: $credential_type"
        print_info "Issuance Date: $issuance_date"
        print_info "Subject DID: $DID"

        print_json "Complete credential response:" "$CREDENTIAL_RESPONSE"

        return 0
    else
        print_error "Credential not found in response"
        print_json "Response:" "$CREDENTIAL_RESPONSE"
        exit 1
    fi
}

# Display usage information
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -u, --url URL          Backend URL (default: http://localhost:8000)"
    echo "  -s, --schema SCHEMA    Schema ID (default: EmployeeBadge)"
    echo "  -p, --pin PIN          User PIN (default: 1234)"
    echo "  -n, --name NAME        Holder name (default: Nitu)"
    echo "  -d, --department DEPT  Department (default: IT)"
    echo "  --designation DESIG    Designation (default: CTO)"
    echo "  -v, --verbose          Verbose output"
    echo "  -h, --help             Show this help"
    echo
    echo "Environment variables:"
    echo "  BASE_URL, SCHEMA_ID, USER_PIN, HOLDER_NAME, DEPARTMENT, DESIGNATION"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -s|--schema)
            SCHEMA_ID="$2"
            shift 2
            ;;
        -p|--pin)
            USER_PIN="$2"
            shift 2
            ;;
        -n|--name)
            HOLDER_NAME="$2"
            shift 2
            ;;
        -d|--department)
            DEPARTMENT="$2"
            shift 2
            ;;
        --designation)
            DESIGNATION="$2"
            shift 2
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_info "🚀 Starting Enhanced OpenID4VCI Credential Issuance Flow"
    print_info "Base URL: $BASE_URL"
    print_info "Schema: $SCHEMA_ID"
    print_info "Holder: $HOLDER_NAME ($DEPARTMENT - $DESIGNATION)"
    echo

    check_dependencies
    check_backend

    create_credential_offer
    echo

    retrieve_credential_offer
    echo

    exchange_code_for_token
    echo

    create_pop_jwt
    echo

    request_credential
    echo

    print_success "🎉 OpenID4VCI flow completed successfully!"
    print_info "The credential has been issued and can now be stored in the wallet."
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
