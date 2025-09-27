
import * as ed from '@noble/ed25519'

function toBase58(bytes: Uint8Array) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let x = BigInt(0)
  for (const b of bytes) x = (x << BigInt(8)) + BigInt(b)
  const base = BigInt(58)
  let out = ''
  while (x > 0) { const mod = x % base; out = ALPHABET[Number(mod)] + out; x /= base }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break }
  return out || '1'
}

export async function createDidKey() {
  const sk = ed.utils.randomPrivateKey()
  const pk = await ed.getPublicKeyAsync(sk)
  // multicodec for ed25519 pubkey is 0xED 0x01 prefix
  const prefix = new Uint8Array([0xed, 0x01])
  const withPrefix = new Uint8Array(prefix.length + pk.length)
  withPrefix.set(prefix, 0); withPrefix.set(pk, prefix.length)
  const did = 'did:key:z' + toBase58(withPrefix)
  return { did, sk, pk }
}
