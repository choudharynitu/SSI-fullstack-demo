#!/bin/bash

# Complete OID4VP Protocol Test Script
# This script tests the full OpenID4VP flow step by step

set -e

BASE_URL="http://localhost:8000"

echo "🔐 Complete OID4VP Protocol Test"
echo "================================"

# Step 1: Create presentation request
echo "Step 1: Creating presentation request..."
REQUEST_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/oid4vp/presentation-request \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test-client"}')

REQUEST_ID=$(echo "$REQUEST_RESPONSE" | jq -r '.request_id')
REQUEST_URI=$(echo "$REQUEST_RESPONSE" | jq -r '.request_uri')
DIRECT_URL=$(echo "$REQUEST_RESPONSE" | jq -r '.direct_request_url')
STATE=$(echo "$REQUEST_RESPONSE" | jq -r '.presentation_request.state')
NONCE=$(echo "$REQUEST_RESPONSE" | jq -r '.presentation_request.nonce')

echo "✅ Request created: $REQUEST_ID"
echo "📱 Request URI: $REQUEST_URI"
echo "🔗 Direct URL: $DIRECT_URL"

# Step 2: Wallet fetches the request (simulating wallet behavior)
echo ""
echo "Step 2: Wallet fetches presentation request..."
WALLET_REQUEST=$(curl -s "$DIRECT_URL")
echo "✅ Wallet received request: $(echo "$WALLET_REQUEST" | jq -r '.client_id')"

# Step 3: Create a mock verifiable presentation (what a wallet would do)
echo ""
echo "Step 3: Creating mock verifiable presentation..."

# Create a mock JWT VP token (in reality, this would be signed by the wallet's key)
MOCK_VP_HEADER='{"alg":"EdDSA","typ":"JWT"}'
MOCK_VP_PAYLOAD=$(cat <<EOF
{
  "iss": "did:key:z6MkrEuHk1U4TUR4yNJb5ZjudPtmkgjhFNnvNXZpFg564c3v",
  "aud": "test-client",
  "nonce": "$NONCE",
  "vp": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiablePresentation"],
    "verifiableCredential": [
      {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        "type": ["VerifiableCredential", "EmployeeBadge"],
        "issuer": "did:key:z6MkodVVwkzMk16zHkGv4XdzUKzp5fRBDq8RV4rKSQUGu3LF",
        "issuanceDate": "2023-01-01T00:00:00Z",
        "credentialSubject": {
          "id": "did:key:z6MkrEuHk1U4TUR4yNJb5ZjudPtmkgjhFNnvNXZpFg564c3v",
          "name": "John Doe",
          "department": "Engineering",
          "employeeId": "EMP123"
        },
        "proof": {
          "type": "Ed25519Signature2020",
          "created": "2023-01-01T00:00:00Z",
          "verificationMethod": "did:key:z6MkodVVwkzMk16zHkGv4XdzUKzp5fRBDq8RV4rKSQUGu3LF#key-1",
          "proofPurpose": "assertionMethod",
          "proofValue": "mock-proof-value"
        }
      }
    ]
  },
  "iat": $(date +%s)
}
EOF
)

# Create a mock JWT (base64url encoded header.payload.signature)
MOCK_VP_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.$(echo "$MOCK_VP_PAYLOAD" | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=').mock-signature"

echo "✅ Mock VP created"

# Step 4: Wallet sends presentation response
echo ""
echo "Step 4: Sending presentation response to verifier..."
RESPONSE_RESULT=$(curl -s -X POST ${BASE_URL}/api/oid4vp/presentation-response \
  -H "Content-Type: application/json" \
  -d "{\"vp_token\":\"$MOCK_VP_TOKEN\",\"state\":\"$STATE\"}")

echo "Response result:"
echo "$RESPONSE_RESULT" | jq '.'

# Step 5: Check verification results
if echo "$RESPONSE_RESULT" | jq -e '.success' > /dev/null; then
  SESSION_ID=$(echo "$RESPONSE_RESULT" | jq -r '.session_id // empty')

  if [ -n "$SESSION_ID" ]; then
    echo ""
    echo "Step 5: Retrieving verification session..."
    SESSION_RESULT=$(curl -s "${BASE_URL}/api/oid4vp/session/${SESSION_ID}")
    echo "Session result:"
    echo "$SESSION_RESULT" | jq '.'
  fi
fi

# Step 6: Check overall status
echo ""
echo "Step 6: Checking verifier status..."
STATUS=$(curl -s "${BASE_URL}/api/oid4vp/health")
echo "Verifier status:"
echo "$STATUS" | jq '.'

echo ""
echo "🎉 OID4VP Protocol Test Complete!"
echo "================================"
echo "Request ID: $REQUEST_ID"
echo "State: $STATE"
echo "Nonce: $NONCE"

# Show active requests and sessions
echo ""
echo "📋 Summary:"
REQUESTS=$(curl -s "${BASE_URL}/api/oid4vp/requests")
SESSIONS=$(curl -s "${BASE_URL}/api/oid4vp/sessions")

echo "Active requests: $(echo "$REQUESTS" | jq -r '.count')"
echo "Active sessions: $(echo "$SESSIONS" | jq -r '.count')"

if [ "$(echo "$SESSIONS" | jq -r '.count')" -gt 0 ]; then
  echo ""
  echo "Latest session results:"
  echo "$SESSIONS" | jq '.sessions[0]'
fi