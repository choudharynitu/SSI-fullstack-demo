// pop.js — generate a did:key and a PoP (EdDSA) JWT for OID4VCI
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import bs58 from 'bs58'

// ----- helpers -----
function didKeyFromEd25519Jwk(pubJwk) {
  // pubJwk.x is base64url. Node 20+ supports 'base64url' directly.
  const x = Buffer.from(pubJwk.x, 'base64url')
  // multicodec prefix for Ed25519 public key: 0xED 0x01
  const prefixed = Buffer.concat([Buffer.from([0xed, 0x01]), x])
  return 'did:key:z' + bs58.encode(prefixed)
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

// ----- inputs from env -----
const C_NONCE = requireEnv('C_NONCE')                  // from /token
const CRED_ISSUER = requireEnv('CRED_ISSUER')          // e.g. http://localhost:8000/api

// ----- keypair (extractable so we can export public JWK) -----
const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true })
const pubJwk = await exportJWK(publicKey)
pubJwk.crv = pubJwk.crv || 'Ed25519'                   // be explicit for safety

// Build did:key from public JWK
const did = didKeyFromEd25519Jwk(pubJwk)

// ----- build PoP JWT -----
const now = Math.floor(Date.now() / 1000)
const payload = {
  iss: did,
  sub: did,
  aud: CRED_ISSUER,
  iat: now,
  nbf: now,
  exp: now + 600,
  nonce: C_NONCE,
}

const popJwt = await new SignJWT(payload)
  .setProtectedHeader({ alg: 'EdDSA' })
  .sign(privateKey)

// Print results (easy to parse with awk/jq)
console.log('DID', did)
console.log('POP_JWT', popJwt)
