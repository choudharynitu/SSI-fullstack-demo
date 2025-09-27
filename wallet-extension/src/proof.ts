import { SignJWT } from 'jose'

function toBase64Url(u8: Uint8Array) {
  // standard base64
  let str = ''
  for (let i = 0; i < u8.length; i++) str += String.fromCharCode(u8[i])
  const b64 = btoa(str)
  // convert to base64url
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function buildProofJWT({
  holderDid,
  audience,
  nonce,
  sk
}: {
  holderDid: string,
  audience: string,
  nonce: string,
  sk: Uint8Array
}) {
  // jose can accept a JWK for EdDSA OKP keys
  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: toBase64Url(sk),
    // 'x' is not strictly needed for signing when 'd' is present, but you can add it if you have the pubkey
  } as any

  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({
      nonce,
      iat: now,
      nbf: now,
      jti: crypto.randomUUID(),
      attestation: 'openid_credential'
    })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(holderDid)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(jwk)
}
/*import { SignJWT } from 'jose'

export async function buildProofJWT({ holderDid, audience, nonce, sk } : { holderDid: string, audience: string, nonce: string, sk: Uint8Array }) {
  // Using EdDSA (Ed25519) with raw secret key (jose expects a CryptoKey or KeyLike; we'll use 'EdDSA' with a JWK)
  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: Buffer.from(sk).toString('base64url'),
    x: '' // filled at call site if needed
  }
  const now = Math.floor(Date.now()/1000)
  const jwt = await new SignJWT({ nonce, iat: now, nbf: now, jti: crypto.randomUUID(), 'attestation': 'openid_credential' })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(holderDid)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(jwk as any)
  return jwt
}*/
