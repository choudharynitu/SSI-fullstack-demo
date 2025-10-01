#!/bin/bash

# Debug script to capture VP token being sent to verifier
echo "🔍 Creating simple presentation request"
PRESENTATION_REQUEST_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/oid4vp/presentation-request" \
    -H "Content-Type: application/json" \
    -d '{
        "client_id": "debug-test",
        "presentation_definition": {
            "id": "debug",
            "input_descriptors": [
                {
                    "id": "any_credential",
                    "name": "Any Verifiable Credential",
                    "constraints": {
                        "fields": [
                            {
                                "path": ["$.type"],
                                "filter": {
                                    "type": "array",
                                    "contains": {
                                        "const": "VerifiableCredential"
                                    }
                                }
                            }
                        ]
                    }
                }
            ]
        }
    }')

REQUEST_URI=$(echo "$PRESENTATION_REQUEST_RESPONSE" | jq -r '.request_uri')
echo "📨 Request URI: $REQUEST_URI"

echo "🎯 Calling wallet to preview presentation"
PREVIEW_RESPONSE=$(curl -s -X POST "http://localhost:9000/preview-presentation" \
    -H "Content-Type: application/json" \
    -d "{\"request_uri\": \"$REQUEST_URI\"}")

echo "📋 Preview response:"
echo "$PREVIEW_RESPONSE" | jq .

echo "🚀 Creating presentation"
PRESENTATION_RESPONSE=$(curl -s -X POST "http://localhost:9000/present-credentials" \
    -H "Content-Type: application/json" \
    -d "{
        \"request_uri\": \"$REQUEST_URI\",
        \"auto_select\": true
    }")

echo "📤 Presentation response:"
echo "$PRESENTATION_RESPONSE" | jq .