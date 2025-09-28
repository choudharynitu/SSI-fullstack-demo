#!/usr/bin/env node

/**
 * Proof of Possession JWT Generator for OpenID4VCI
 *
 * This script generates a proper Ed25519 key pair and creates a JWT
 * that serves as proof of possession for the OpenID4VCI flow.
 */

const crypto = require('crypto');

// Simple base58 encoding function for DID:key
function toBase58(bytes) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let x = BigInt(0);
    for (const b of bytes) x = (x << BigInt(8)) + BigInt(b);
    const base = BigInt(58);
    let out = '';
    while (x > 0) {
        const mod = x % base;
        out = ALPHABET[Number(mod)] + out;
        x = x / base;
    }
    for (const b of bytes) {
        if (b === 0) out = '1' + out;
        else break;
    }
    return out || '1';
}

// Create DID:key from Ed25519 public key
function createDidKey(publicKeyBytes) {
    // multicodec for ed25519 pubkey is 0xED 0x01 prefix
    const prefix = new Uint8Array([0xed, 0x01]);
    const withPrefix = new Uint8Array(prefix.length + publicKeyBytes.length);
    withPrefix.set(prefix, 0);
    withPrefix.set(publicKeyBytes, prefix.length);
    return 'did:key:z' + toBase58(withPrefix);
}

// Base64url encoding
function base64urlEscape(str) {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlEncode(data) {
    return base64urlEscape(Buffer.from(data).toString('base64'));
}

async function createPopJWT() {
    try {
        // Get environment variables
        const cNonce = process.env.C_NONCE;
        const audience = process.env.CRED_ISSUER || 'http://localhost:8000/api';

        if (!cNonce) {
            console.error('Error: C_NONCE environment variable is required');
            process.exit(1);
        }

        // Generate Ed25519 key pair
        const { publicKey, privateKey } = await crypto.subtle.generateKey(
            'Ed25519',
            true,
            ['sign', 'verify']
        );

        // Export keys
        const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
        const privateKeyBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));

        // Create DID:key
        const did = createDidKey(publicKeyBytes);

        // Current timestamp
        const now = Math.floor(Date.now() / 1000);

        // JWT header
        const header = {
            alg: 'EdDSA',
            typ: 'JWT'
        };

        // JWT payload
        const payload = {
            iss: did,
            sub: did,
            aud: audience,
            iat: now,
            nbf: now,
            exp: now + 300, // 5 minutes
            nonce: cNonce,
            jti: crypto.randomUUID(),
            attestation: 'openid_credential'
        };

        // Encode header and payload
        const encodedHeader = base64urlEncode(JSON.stringify(header));
        const encodedPayload = base64urlEncode(JSON.stringify(payload));
        const signingInput = `${encodedHeader}.${encodedPayload}`;

        // Sign the JWT
        const messageBytes = new TextEncoder().encode(signingInput);
        const signature = await crypto.subtle.sign('Ed25519', privateKey, messageBytes);
        const encodedSignature = base64urlEscape(Buffer.from(signature).toString('base64'));

        const jwt = `${signingInput}.${encodedSignature}`;

        // Output results
        console.log(`DID ${did}`);
        console.log(`POP_JWT ${jwt}`);

    } catch (error) {
        console.error('Error creating PoP JWT:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    createPopJWT().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { createPopJWT, createDidKey, base64urlEncode };