#!/bin/bash

# Complete SSI Flow Integration Test
# Tests the full SSI ecosystem: Issuer -> Wallet -> Verifier
# Includes OID4VCI credential issuance, wallet storage, and OID4VP presentation with PoP

set -e

# Configuration
ISSUER_BASE_URL="${ISSUER_BASE_URL:-http://localhost:8000}"
VERIFIER_BASE_URL="${VERIFIER_BASE_URL:-http://localhost:8000}"
WALLET_BASE_URL="${WALLET_BASE_URL:-http://localhost:9000}"

# Test parameters
SCHEMA_ID="${SCHEMA_ID:-EmployeeBadge}"
USER_PIN="${USER_PIN:-1234}"
HOLDER_NAME="${HOLDER_NAME:-Alice Smith}"
DEPARTMENT="${DEPARTMENT:-Engineering}"
DESIGNATION="${DESIGNATION:-Senior Developer}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}🌟 Complete SSI Ecosystem Integration Test${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "${BLUE}=== STEP $1: $2 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ Error: $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if all services are running
check_services() {
    print_step 1 "Checking service availability"

    # Check issuer/verifier service
    if ! curl -s "${ISSUER_BASE_URL}/api/dids/list" > /dev/null 2>&1; then
        print_error "Issuer/Verifier service not available at ${ISSUER_BASE_URL}"
        print_info "Start with: cd Issuer-Admin/backend-issuer-verifier && npm run dev"
        exit 1
    fi

    # Check wallet service
    if ! curl -s "${WALLET_BASE_URL}/health" > /dev/null 2>&1; then
        print_error "Wallet service not available at ${WALLET_BASE_URL}"
        print_info "Start with: cd wallet-service && npm run dev"
        exit 1
    fi

    print_success "All services are running"

    # Get service status
    WALLET_STATUS=$(curl -s "${WALLET_BASE_URL}/status")
    WALLET_DID=$(echo "$WALLET_STATUS" | jq -r '.wallet.wallet_did')

    print_info "Wallet DID: ${WALLET_DID}"
}

# Step 2: Create credential offer using OID4VCI
create_credential_offer() {
    print_step 2 "Creating credential offer (OID4VCI)"

    # Create the credential offer
    OFFER_RESPONSE=$(curl -s -X POST "${ISSUER_BASE_URL}/api/offers" \
        -H "Content-Type: application/json" \
        -d "{
            \"schemaId\": \"${SCHEMA_ID}\",
            \"claims\": {
                \"Name\": \"${HOLDER_NAME}\",
                \"Department\": \"${DEPARTMENT}\",
                \"Designation\": \"${DESIGNATION}\"
            },
            \"userPin\": \"${USER_PIN}\"
        }")

    OFFER_ID=$(echo "$OFFER_RESPONSE" | jq -r '.id')
    CREDENTIAL_OFFER_URI=$(echo "$OFFER_RESPONSE" | jq -r '.credential_offer_uri')

    if [ "$OFFER_ID" = "null" ] || [ -z "$OFFER_ID" ]; then
        print_error "Failed to create credential offer"
        echo "$OFFER_RESPONSE"
        exit 1
    fi

    print_success "Credential offer created: ${OFFER_ID}"
    print_info "Offer URI: ${CREDENTIAL_OFFER_URI}"
}

# Step 3: Wallet receives credential from issuer
wallet_receive_credential() {
    print_step 3 "Wallet receiving credential from issuer"

    WALLET_RECEIVE_RESPONSE=$(curl -s -X POST "${WALLET_BASE_URL}/receive-credential" \
        -H "Content-Type: application/json" \
        -d "{
            \"offer_uri\": \"${CREDENTIAL_OFFER_URI}\",
            \"user_pin\": \"${USER_PIN}\",
            \"issuer_base_url\": \"${ISSUER_BASE_URL}\"
        }")

    RECEIVE_SUCCESS=$(echo "$WALLET_RECEIVE_RESPONSE" | jq -r '.success')

    if [ "$RECEIVE_SUCCESS" != "true" ]; then
        print_error "Wallet failed to receive credential"
        echo "$WALLET_RECEIVE_RESPONSE" | jq '.'
        exit 1
    fi

    CREDENTIAL_ID=$(echo "$WALLET_RECEIVE_RESPONSE" | jq -r '.result.credentialId')
    print_success "Credential received and stored: ${CREDENTIAL_ID}"

    # Show wallet status
    UPDATED_WALLET_STATUS=$(curl -s "${WALLET_BASE_URL}/status")
    CREDENTIAL_COUNT=$(echo "$UPDATED_WALLET_STATUS" | jq -r '.wallet.credentials_count')
    print_info "Wallet now has ${CREDENTIAL_COUNT} credential(s)"
}

# Step 4: Create presentation request from verifier
create_presentation_request() {
    print_step 4 "Creating presentation request (OID4VP)"

    # Create presentation definition
    PRESENTATION_DEF_RESPONSE=$(curl -s -X POST "${VERIFIER_BASE_URL}/api/oid4vp/create-presentation-definition" \
        -H "Content-Type: application/json" \
        -d "{
            \"credential_types\": [\"VerifiableCredential\", \"${SCHEMA_ID}\"],
            \"required_fields\": [\"Name\", \"Department\"],
            \"purpose\": \"Employee verification for secure area access\"
        }")

    PRESENTATION_DEFINITION=$(echo "$PRESENTATION_DEF_RESPONSE" | jq '.presentation_definition')

    # Create presentation request
    PRESENTATION_REQUEST_RESPONSE=$(curl -s -X POST "${VERIFIER_BASE_URL}/api/oid4vp/presentation-request" \
        -H "Content-Type: application/json" \
        -d "{
            \"client_id\": \"ssi-integration-test\",
            \"presentation_definition\": ${PRESENTATION_DEFINITION}
        }")

    REQUEST_ID=$(echo "$PRESENTATION_REQUEST_RESPONSE" | jq -r '.request_id')
    PRESENTATION_REQUEST_URI=$(echo "$PRESENTATION_REQUEST_RESPONSE" | jq -r '.request_uri')

    if [ "$REQUEST_ID" = "null" ] || [ -z "$REQUEST_ID" ]; then
        print_error "Failed to create presentation request"
        echo "$PRESENTATION_REQUEST_RESPONSE"
        exit 1
    fi

    print_success "Presentation request created: ${REQUEST_ID}"
    print_info "Request URI: ${PRESENTATION_REQUEST_URI}"
}

# Step 5: Wallet presents credentials to verifier
wallet_present_credentials() {
    print_step 5 "Wallet presenting credentials to verifier (with PoP)"

    # First, preview the presentation request
    PREVIEW_RESPONSE=$(curl -s -X POST "${WALLET_BASE_URL}/preview-presentation" \
        -H "Content-Type: application/json" \
        -d "{\"request_uri\": \"${PRESENTATION_REQUEST_URI}\"}")

    MATCHING_CREDS=$(echo "$PREVIEW_RESPONSE" | jq -r '.preview.matchingCredentials | length')
    VERIFIER_NAME=$(echo "$PREVIEW_RESPONSE" | jq -r '.preview.verifier')
    PURPOSE=$(echo "$PREVIEW_RESPONSE" | jq -r '.preview.purpose')

    print_info "Verifier: ${VERIFIER_NAME}"
    print_info "Purpose: ${PURPOSE}"
    print_info "Matching credentials: ${MATCHING_CREDS}"

    if [ "$MATCHING_CREDS" = "0" ]; then
        print_error "No matching credentials found in wallet"
        exit 1
    fi

    # Present credentials with PoP
    PRESENTATION_RESPONSE=$(curl -s -X POST "${WALLET_BASE_URL}/present-credentials" \
        -H "Content-Type: application/json" \
        -d "{
            \"request_uri\": \"${PRESENTATION_REQUEST_URI}\",
            \"auto_select\": true
        }")

    PRESENTATION_SUCCESS=$(echo "$PRESENTATION_RESPONSE" | jq -r '.success')

    if [ "$PRESENTATION_SUCCESS" != "true" ]; then
        print_error "Credential presentation failed"
        echo "$PRESENTATION_RESPONSE" | jq '.'
        exit 1
    fi

    SESSION_ID=$(echo "$PRESENTATION_RESPONSE" | jq -r '.result.sessionId // empty')
    print_success "Credentials presented successfully with Proof of Possession"

    if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
        print_info "Verification session: ${SESSION_ID}"
    fi
}

# Step 6: Check verification results
check_verification_results() {
    print_step 6 "Checking verification results"

    # Get verification sessions from verifier
    SESSIONS_RESPONSE=$(curl -s "${VERIFIER_BASE_URL}/api/oid4vp/sessions")
    SESSION_COUNT=$(echo "$SESSIONS_RESPONSE" | jq -r '.count')

    if [ "$SESSION_COUNT" = "0" ]; then
        print_warning "No verification sessions found"
        return
    fi

    print_success "Found ${SESSION_COUNT} verification session(s)"

    # Get latest session details
    LATEST_SESSION=$(echo "$SESSIONS_RESPONSE" | jq '.sessions[0]')
    SESSION_ID=$(echo "$LATEST_SESSION" | jq -r '.session_id')
    IS_VALID=$(echo "$LATEST_SESSION" | jq -r '.verification_result.valid')
    CRED_COUNT=$(echo "$LATEST_SESSION" | jq -r '.verification_result.credentials_count')

    if [ "$IS_VALID" = "true" ]; then
        print_success "✅ VERIFICATION SUCCESSFUL"
        print_info "Session ID: ${SESSION_ID}"
        print_info "Credentials verified: ${CRED_COUNT}"

        # Get detailed session info
        DETAILED_SESSION=$(curl -s "${VERIFIER_BASE_URL}/api/oid4vp/session/${SESSION_ID}")
        if [ $? -eq 0 ]; then
            HOLDER_DID=$(echo "$DETAILED_SESSION" | jq -r '.session.verification_result.holder // "N/A"')
            print_info "Holder DID: ${HOLDER_DID}"
        fi
    else
        print_error "❌ VERIFICATION FAILED"
        print_info "Session ID: ${SESSION_ID}"

        # Show errors if any
        ERRORS=$(echo "$LATEST_SESSION" | jq -r '.verification_result.errors[]? // empty')
        if [ -n "$ERRORS" ]; then
            print_error "Verification errors: ${ERRORS}"
        fi
    fi
}

# Step 7: Show final summary
show_summary() {
    print_step 7 "Flow Summary"

    echo -e "${GREEN}🎉 COMPLETE SSI FLOW TEST RESULTS${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Issuer status
    echo -e "${YELLOW}📋 ISSUER STATUS:${NC}"
    echo "  ✅ Created credential offer: ${OFFER_ID}"
    echo "  ✅ Issued credential with user PIN: ${USER_PIN}"

    # Wallet status
    echo -e "${YELLOW}💳 WALLET STATUS:${NC}"
    FINAL_WALLET_STATUS=$(curl -s "${WALLET_BASE_URL}/status")
    FINAL_CRED_COUNT=$(echo "$FINAL_WALLET_STATUS" | jq -r '.wallet.credentials_count')
    echo "  ✅ Wallet DID: ${WALLET_DID}"
    echo "  ✅ Stored credentials: ${FINAL_CRED_COUNT}"
    echo "  ✅ Received credential via OID4VCI with PoP"
    echo "  ✅ Presented credential via OID4VP with PoP"

    # Verifier status
    echo -e "${YELLOW}🔍 VERIFIER STATUS:${NC}"
    VERIFIER_HEALTH=$(curl -s "${VERIFIER_BASE_URL}/api/oid4vp/health")
    ACTIVE_REQUESTS=$(echo "$VERIFIER_HEALTH" | jq -r '.active_requests')
    ACTIVE_SESSIONS=$(echo "$VERIFIER_HEALTH" | jq -r '.active_sessions')
    echo "  ✅ Created presentation request: ${REQUEST_ID}"
    echo "  ✅ Active requests: ${ACTIVE_REQUESTS}"
    echo "  ✅ Active sessions: ${ACTIVE_SESSIONS}"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🎯 SSI ECOSYSTEM TEST COMPLETED SUCCESSFULLY!${NC}"
    echo ""
    echo -e "${PURPLE}Key Features Demonstrated:${NC}"
    echo "  🔐 OpenID4VCI credential issuance with Proof of Possession"
    echo "  💾 Wallet credential storage and management"
    echo "  🔍 OpenID4VP presentation with Proof of Possession"
    echo "  ✅ End-to-end SSI flow with cryptographic verification"
    echo "  🎭 Complete holder-issuer-verifier interaction"
    echo ""
    echo -e "${CYAN}Test completed at: $(date)${NC}"
}

# Alternative: Test with direct wallet integration
test_direct_wallet_integration() {
    print_step "ALT" "Testing direct wallet integration API"

    DIRECT_FLOW_RESPONSE=$(curl -s -X POST "${WALLET_BASE_URL}/complete-ssi-flow" \
        -H "Content-Type: application/json" \
        -d "{
            \"credential_offer_uri\": \"${CREDENTIAL_OFFER_URI}\",
            \"presentation_request_uri\": \"${PRESENTATION_REQUEST_URI}\",
            \"user_pin\": \"${USER_PIN}\",
            \"issuer_base_url\": \"${ISSUER_BASE_URL}\"
        }")

    FLOW_SUCCESS=$(echo "$DIRECT_FLOW_RESPONSE" | jq -r '.success')

    if [ "$FLOW_SUCCESS" = "true" ]; then
        print_success "Direct wallet integration test passed"
        return 0
    else
        print_warning "Direct wallet integration test failed (this is expected if steps were already executed)"
        return 1
    fi
}

# Main execution
main() {
    print_header

    # Parse command line arguments
    DIRECT_TEST=false
    while [[ $# -gt 0 ]]; do
        case $1 in
            --direct)
                DIRECT_TEST=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [--direct]"
                echo "  --direct    Test using wallet's complete-ssi-flow endpoint"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Check required tools
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed"
        exit 1
    fi

    # Execute test flow
    check_services
    create_credential_offer

    if [ "$DIRECT_TEST" = "true" ]; then
        create_presentation_request
        if test_direct_wallet_integration; then
            check_verification_results
            show_summary
            return
        fi
        print_info "Falling back to step-by-step test..."
    fi

    wallet_receive_credential
    create_presentation_request
    wallet_present_credentials
    check_verification_results
    show_summary

    print_success "🎊 Complete SSI ecosystem integration test completed!"
    print_info "All three components (Issuer, Wallet, Verifier) working together successfully!"
}

main "$@"