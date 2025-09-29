#!/bin/bash

# Enhanced OpenID4VP Complete Verification Flow Script
# This script demonstrates the complete presentation verification flow using OpenID4VP protocol
#

set -e  # Exit on any error

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
CREDENTIAL_TYPES="${CREDENTIAL_TYPES:-VerifiableCredential,EmployeeBadge}"
REQUIRED_FIELDS="${REQUIRED_FIELDS:-name,department}"
TRUSTED_ISSUERS="${TRUSTED_ISSUERS:-}"
VERIFICATION_PURPOSE="${VERIFICATION_PURPOSE:-Please provide your employee credentials for workplace access verification}"
CLIENT_ID="${CLIENT_ID:-oid4vp-verifier-demo}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
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

# Function to check if server is running
check_server() {
    print_step 1 "Checking if server is running"

    if ! curl -s "${BASE_URL}/api/oid4vp/health" > /dev/null 2>&1; then
        print_error "Server is not running at ${BASE_URL}"
        print_info "Please start the server with: cd Issuer-Admin/backend-issuer-verifier && npm run dev"
        exit 1
    fi

    print_success "Server is running and healthy"
}

# Function to create presentation definition
create_presentation_definition() {
    print_step 2 "Creating Presentation Definition"

    # Convert comma-separated values to JSON arrays using jq
    TYPES_JSON=$(echo "$CREDENTIAL_TYPES" | tr ',' '\n' | jq -R -s -c 'split("\n")[:-1]')
    FIELDS_JSON=$(echo "$REQUIRED_FIELDS" | tr ',' '\n' | jq -R -s -c 'split("\n")[:-1]')

    if [ -n "$TRUSTED_ISSUERS" ]; then
        ISSUERS_JSON=$(echo "$TRUSTED_ISSUERS" | tr ',' '\n' | jq -R -s -c 'split("\n")[:-1]')
    else
        ISSUERS_JSON="[]"
    fi

    # Create presentation definition
    PRESENTATION_DEF_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/oid4vp/create-presentation-definition" \
        -H "Content-Type: application/json" \
        -d "{
            \"credential_types\": ${TYPES_JSON},
            \"required_fields\": ${FIELDS_JSON},
            \"trusted_issuers\": ${ISSUERS_JSON},
            \"purpose\": \"${VERIFICATION_PURPOSE}\"
        }")

    if [ $? -ne 0 ]; then
        print_error "Failed to create presentation definition"
        exit 1
    fi

    # Check if the response indicates success
    SUCCESS=$(echo "$PRESENTATION_DEF_RESPONSE" | jq -r '.success // false')
    if [ "$SUCCESS" != "true" ]; then
        print_error "Presentation definition creation failed: $(echo "$PRESENTATION_DEF_RESPONSE" | jq -r '.error // "Unknown error"')"
        exit 1
    fi

    PRESENTATION_DEFINITION=$(echo "$PRESENTATION_DEF_RESPONSE" | jq '.presentation_definition')
    print_success "Presentation definition created successfully"

    # Display the presentation definition
    echo -e "${PURPLE}Presentation Definition:${NC}"
    echo "$PRESENTATION_DEFINITION" | jq '.'
}

# Function to create presentation request
create_presentation_request() {
    print_step 3 "Creating Presentation Request"

    REQUEST_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/oid4vp/presentation-request" \
        -H "Content-Type: application/json" \
        -d "{
            \"client_id\": \"${CLIENT_ID}\",
            \"presentation_definition\": ${PRESENTATION_DEFINITION}
        }")

    if [ $? -ne 0 ]; then
        print_error "Failed to create presentation request"
        exit 1
    fi

    # Check if the response indicates success
    SUCCESS=$(echo "$REQUEST_RESPONSE" | jq -r '.success // false')
    if [ "$SUCCESS" != "true" ]; then
        print_error "Presentation request creation failed: $(echo "$REQUEST_RESPONSE" | jq -r '.error // "Unknown error"')"
        exit 1
    fi

    REQUEST_ID=$(echo "$REQUEST_RESPONSE" | jq -r '.request_id')
    REQUEST_URI=$(echo "$REQUEST_RESPONSE" | jq -r '.request_uri')
    DIRECT_REQUEST_URL=$(echo "$REQUEST_RESPONSE" | jq -r '.direct_request_url')

    print_success "Presentation request created successfully"
    print_info "Request ID: ${REQUEST_ID}"
    print_info "Request URI: ${REQUEST_URI}"
    print_info "Direct URL: ${DIRECT_REQUEST_URL}"

    echo ""
    echo -e "${YELLOW}🔗 PRESENTATION REQUEST CREATED!${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}Request URI (for QR code):${NC}"
    echo -e "${BLUE}${REQUEST_URI}${NC}"
    echo ""
    echo -e "${PURPLE}Direct Request URL (for testing):${NC}"
    echo -e "${BLUE}${DIRECT_REQUEST_URL}${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to monitor for presentation response
monitor_presentation_response() {
    print_step 4 "Monitoring for presentation response"

    print_info "Waiting for wallet to respond to the presentation request..."
    print_warning "In a real scenario, the wallet would scan the QR code and respond automatically"
    print_info "For testing, you can manually send a presentation to: ${BASE_URL}/api/oid4vp/presentation-response"

    TIMEOUT=300  # 5 minutes timeout
    ELAPSED=0
    POLL_INTERVAL=5

    while [ $ELAPSED -lt $TIMEOUT ]; do
        # List active sessions to check for responses
        SESSIONS_RESPONSE=$(curl -s "${BASE_URL}/api/oid4vp/sessions" 2>/dev/null || echo '{"success": false}')

        if [ $? -eq 0 ]; then
            SUCCESS=$(echo "$SESSIONS_RESPONSE" | jq -r '.success // false')
            if [ "$SUCCESS" = "true" ]; then
                SESSION_COUNT=$(echo "$SESSIONS_RESPONSE" | jq -r '.count // 0')
                if [ "$SESSION_COUNT" -gt 0 ]; then
                    print_success "Found verification session(s)!"
                    return 0
                fi
            fi
        fi

        printf "\r${YELLOW}⏳ Waiting... (${ELAPSED}s/${TIMEOUT}s)${NC}"
        sleep $POLL_INTERVAL
        ELAPSED=$((ELAPSED + POLL_INTERVAL))
    done

    printf "\n"
    print_warning "No presentation response received within timeout period"
    return 1
}

# Function to display verification results
display_verification_results() {
    print_step 5 "Retrieving Verification Results"

    # Get latest verification sessions
    SESSIONS_RESPONSE=$(curl -s "${BASE_URL}/api/oid4vp/sessions")

    if [ $? -ne 0 ]; then
        print_error "Failed to retrieve verification sessions"
        return 1
    fi

    SUCCESS=$(echo "$SESSIONS_RESPONSE" | jq -r '.success // false')
    if [ "$SUCCESS" != "true" ]; then
        print_error "Failed to get sessions: $(echo "$SESSIONS_RESPONSE" | jq -r '.error // "Unknown error"')"
        return 1
    fi

    SESSION_COUNT=$(echo "$SESSIONS_RESPONSE" | jq -r '.count // 0')
    if [ "$SESSION_COUNT" -eq 0 ]; then
        print_warning "No verification sessions found"
        return 1
    fi

    echo -e "${GREEN}📊 VERIFICATION RESULTS${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Display each session
    echo "$SESSIONS_RESPONSE" | jq -r '.sessions[] |
        "Session ID: " + .session_id +
        "\nRequest ID: " + .request_id +
        "\nValid: " + (if .verification_result.valid then "✅ YES" else "❌ NO" end) +
        "\nCredentials Count: " + (.verification_result.credentials_count | tostring) +
        "\nTimestamp: " + .timestamp +
        "\n" + "─" * 70'

    # Get detailed results for the latest session
    LATEST_SESSION_ID=$(echo "$SESSIONS_RESPONSE" | jq -r '.sessions[0].session_id')
    if [ "$LATEST_SESSION_ID" != "null" ]; then
        print_info "Fetching detailed results for session: ${LATEST_SESSION_ID}"

        SESSION_DETAIL_RESPONSE=$(curl -s "${BASE_URL}/api/oid4vp/session/${LATEST_SESSION_ID}")

        if [ $? -eq 0 ]; then
            SUCCESS=$(echo "$SESSION_DETAIL_RESPONSE" | jq -r '.success // false')
            if [ "$SUCCESS" = "true" ]; then
                echo -e "${PURPLE}📋 DETAILED VERIFICATION RESULT:${NC}"
                echo "$SESSION_DETAIL_RESPONSE" | jq '.session.verification_result'
            fi
        fi
    fi

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to simulate a presentation response (for testing)
simulate_presentation_response() {
    print_step "DEMO" "Simulating Presentation Response (Testing Mode)"

    print_warning "This is a demo mode that simulates a wallet response"
    print_info "In production, a real wallet would respond to the presentation request"

    # Create a sample JWT presentation (this would come from a real wallet)
    SAMPLE_VP_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkaWQ6a2V5OnowNk1rdVNBUUFQOHVVWW01eUpqNWZyV2VBZGJWdEFxV1M2YVNwNjVYTUJoeXBxQkgiLCJhdWQiOiJvaWQ0dnAtdmVyaWZpZXItZGVtbyIsIm5vbmNlIjoiZGVtby1ub25jZSIsInZwIjp7IkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIl0sInR5cGUiOlsiVmVyaWZpYWJsZVByZXNlbnRhdGlvbiJdLCJ2ZXJpZmlhYmxlQ3JlZGVudGlhbCI6WyJzYW1wbGUtY3JlZGVudGlhbC1qd3QiXX0sImlhdCI6MTY0MDk5NTIwMH0.demo_signature"

    # Send the simulated response
    RESPONSE=$(curl -s -X POST "${BASE_URL}/api/oid4vp/presentation-response" \
        -H "Content-Type: application/json" \
        -d "{
            \"vp_token\": \"${SAMPLE_VP_TOKEN}\",
            \"state\": \"demo-state\"
        }")

    if [ $? -ne 0 ]; then
        print_error "Failed to simulate presentation response"
        return 1
    fi

    print_info "Simulated presentation response sent"
    echo "$RESPONSE" | jq '.'
}

# Function to display help
show_help() {
    echo -e "${BLUE}OpenID4VP Verifier Script${NC}"
    echo ""
    echo "This script demonstrates the OpenID4VP presentation verification flow."
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  $0 [options]"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  -h, --help              Show this help message"
    echo "  -d, --demo              Run in demo mode with simulated responses"
    echo "  -m, --monitor-only      Only monitor for existing sessions"
    echo "  -s, --status            Show current verifier status"
    echo ""
    echo -e "${YELLOW}Environment Variables:${NC}"
    echo "  BASE_URL                Server base URL (default: http://localhost:8000)"
    echo "  CREDENTIAL_TYPES        Comma-separated credential types (default: VerifiableCredential,EmployeeBadge)"
    echo "  REQUIRED_FIELDS         Comma-separated required fields (default: name,department)"
    echo "  TRUSTED_ISSUERS         Comma-separated trusted issuer DIDs (default: empty)"
    echo "  VERIFICATION_PURPOSE    Purpose of the verification (default: workplace access verification)"
    echo "  CLIENT_ID               Verifier client ID (default: oid4vp-verifier-demo)"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0                                    # Full verification flow"
    echo "  $0 --demo                            # Run with simulated responses"
    echo "  $0 --monitor-only                    # Only check for existing results"
    echo "  CREDENTIAL_TYPES='DrivingLicense' $0 # Request driving license credentials"
}

# Function to show verifier status
show_status() {
    print_step "STATUS" "Checking Verifier Status"

    # Check health
    HEALTH_RESPONSE=$(curl -s "${BASE_URL}/api/oid4vp/health" 2>/dev/null || echo '{"success": false}')

    if [ $? -eq 0 ]; then
        SUCCESS=$(echo "$HEALTH_RESPONSE" | jq -r '.success // false')
        if [ "$SUCCESS" = "true" ]; then
            print_success "Verifier service is healthy"
            echo "$HEALTH_RESPONSE" | jq '.'
        else
            print_error "Verifier service health check failed"
        fi
    else
        print_error "Cannot connect to verifier service"
        return 1
    fi

    # Show active requests
    echo ""
    print_info "Active Presentation Requests:"
    REQUESTS_RESPONSE=$(curl -s "${BASE_URL}/api/oid4vp/requests" 2>/dev/null || echo '{"success": false}')

    if [ $? -eq 0 ]; then
        SUCCESS=$(echo "$REQUESTS_RESPONSE" | jq -r '.success // false')
        if [ "$SUCCESS" = "true" ]; then
            REQUEST_COUNT=$(echo "$REQUESTS_RESPONSE" | jq -r '.count // 0')
            if [ "$REQUEST_COUNT" -gt 0 ]; then
                echo "$REQUESTS_RESPONSE" | jq '.requests[] | "ID: " + .id + " | Client: " + .client_id + " | Created: " + .created_at'
            else
                print_info "No active presentation requests"
            fi
        fi
    fi

    # Show recent sessions
    echo ""
    print_info "Recent Verification Sessions:"
    display_verification_results
}

# Main function
main() {
    echo -e "${PURPLE}🔐 OpenID4VP Verifier Flow Script${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Parse command line arguments
    DEMO_MODE=false
    MONITOR_ONLY=false
    SHOW_STATUS=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--demo)
                DEMO_MODE=true
                shift
                ;;
            -m|--monitor-only)
                MONITOR_ONLY=true
                shift
                ;;
            -s|--status)
                SHOW_STATUS=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use -h or --help for usage information"
                exit 1
                ;;
        esac
    done

    if [ "$SHOW_STATUS" = true ]; then
        show_status
        exit 0
    fi

    if [ "$MONITOR_ONLY" = true ]; then
        display_verification_results
        exit 0
    fi

    # Check if required tools are available
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq to parse JSON responses"
        exit 1
    fi

    # Run the verification flow
    check_server
    create_presentation_definition
    create_presentation_request

    if [ "$DEMO_MODE" = true ]; then
        simulate_presentation_response
        sleep 2  # Give it a moment to process
    else
        if ! monitor_presentation_response; then
            print_warning "You can still check for verification results later using: $0 --monitor-only"
            exit 0
        fi
    fi

    display_verification_results

    echo ""
    print_success "OpenID4VP verification flow completed!"
    print_info "You can run '$0 --status' to check the current verifier status"
    print_info "You can run '$0 --monitor-only' to check for new verification results"
}

# Run the main function
main "$@"