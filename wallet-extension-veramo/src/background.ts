// background.ts — OID4VCI flow runner
import * as jose from 'jose'
import bs58 from 'bs58'
import type { JWK, KeyLike } from 'jose'

function b64urlToU8(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  if (s.length % 4) s += '='.repeat(4 - (s.length % 4));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}


type PendingOffer = {
  credential_offer_uri: string
  details?: any               // the dereferenced offer JSON
}

type StoredState = {
  did?: string
  privateKeyJwk?: jose.JWK
  credentials?: string[]      // array of JWT VCs
  pending?: PendingOffer | null
}

// ---------- small storage helpers ----------
async function loadState(): Promise<StoredState> {
  const obj = await chrome.storage.local.get(['did','privateKeyJwk','credentials','pending'])
  return { did: obj.did, privateKeyJwk: obj.privateKeyJwk, credentials: obj.credentials || [], pending: obj.pending || null }
}
async function saveState(p: Partial<StoredState>) {
  await chrome.storage.local.set(p)
}
async function pushCredential(jwtVc: string) {
  const st = await loadState()
  const arr = st.credentials || []
  arr.unshift(jwtVc)
  await saveState({ credentials: arr })
}

// ---------- DID (did:key) ----------
function didKeyFromEd25519PublicJwk(pubJwk: { x: string }): string {
  const x = b64urlToU8(pubJwk.x);             // raw 32 bytes
  const prefixed = new Uint8Array(2 + x.length);
  prefixed.set([0xed, 0x01], 0);              // multicodec 0xED 0x01
  prefixed.set(x, 2);
  return 'did:key:z' + bs58.encode(prefixed); // bs58 accepts Uint8Array
}

async function ensureDid(): Promise<{ did: string, privateKey: KeyLike }> {
  const st = await loadState()
  if (st.did && st.privateKeyJwk) {
    const privateKey = await jose.importJWK(st.privateKeyJwk, 'EdDSA') as KeyLike;
    return { did: st.did, privateKey }
  }
  const { publicKey, privateKey } = await jose.generateKeyPair('EdDSA', { extractable: true })
  const pubJwk = await jose.exportJWK(publicKey); (pubJwk as any).crv = 'Ed25519';
  const privJwk = await jose.exportJWK(privateKey); (privJwk as any).crv = 'Ed25519';
  const did = didKeyFromEd25519PublicJwk(pubJwk as any)
  await saveState({ did, privateKeyJwk: privJwk })
  return { did, privateKey: privateKey as KeyLike };
}

// ---------- OID4VCI ----------
async function dereferenceOffer(offerUri: string) {
  const res = await fetch(offerUri)
  if (!res.ok) throw new Error(`offer_fetch_failed ${res.status}`)
  return res.json()
}

async function exchangeToken(issuerBase: string, preCode: string, userPin?: string) {
  const res = await fetch(`${issuerBase}/oid4vci/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
      'pre-authorized_code': preCode,
      user_pin: userPin || undefined,
    })
  })
  if (!res.ok) throw new Error(`token_failed ${res.status} ${await res.text()}`)
  return res.json()
}

async function requestCredential(
  issuerBase: string,
  accessToken: string,
  c_nonce: string,
  did: string,
  privateKey: KeyLike,   // <— was CryptoKey
  type: string
) {
  const now = Math.floor(Date.now()/1000);
  const pop = await new jose.SignJWT({
    iss: did, sub: did, aud: issuerBase, iat: now, nbf: now, exp: now + 600, nonce: c_nonce
  })
  .setProtectedHeader({ alg: 'EdDSA' })
  .sign(privateKey);

  const res = await fetch(`${issuerBase}/oid4vci/credential`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      type, format: 'jwt_vc',
      proof: { proof_type: 'jwt', jwt: pop },
      credential_subject: { id: did }
    })
  });
  if (!res.ok) throw new Error(`credential_failed ${res.status} ${await res.text()}`);
  return res.json();
}


// ---------- UI messaging ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  ;(async () => {
    if (msg.type === 'CREATE_DID') {
      const { did } = await ensureDid()
      sendResponse({ did })
    }

    if (msg.type === 'START_OID4VCI') {
      const { credential_offer_uri } = msg
      const details = await dereferenceOffer(credential_offer_uri)
      await saveState({ pending: { credential_offer_uri, details } })
      sendResponse({ ok: true })
    }

    if (msg.type === 'OPEN_POPUP') {
      // MV3 can open the popup only from UI clicks; content script already initiated a user gesture.
      chrome.action.openPopup().catch(() => {})
      sendResponse({ ok: true })
    }

    if (msg.type === 'WALLET_DECISION') {
      const { accept, userPin } = msg
      const st = await loadState()
      if (!st.pending) { sendResponse({ error: 'no_pending_offer' }); return }

      if (!accept) {
        await saveState({ pending: null })
        sendResponse({ ok: true, dismissed: true })
        return
      }

      try {
        const offer = st.pending.details
        const issuerBase = offer.credential_issuer            // e.g. http://localhost:8000/api
        const pre = offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code']
        const types = offer.credential_configuration_ids      // array (we use first)
        const type = Array.isArray(types) && types[0] ? types[0] : 'VerifiableCredential'

        const token = await exchangeToken(issuerBase, pre, userPin)
        const { did, privateKey } = await ensureDid()
        const out = await requestCredential(issuerBase, token.access_token, token.c_nonce, did, privateKey, type)

        // persist and clear pending
        await pushCredential(out.credential)
        await saveState({ pending: null })
        sendResponse({ ok: true, stored: true, did, type })
      } catch (e: any) {
        sendResponse({ error: String(e?.message || e) })
      }
    }
  })()
  return true // async response
})


/*import { createAgent, IIdentifier } from "@veramo/core"
import { KeyManager } from "@veramo/key-manager"
import { DIDManager } from "@veramo/did-manager"
import { KeyDIDProvider } from "@veramo/did-provider-key"
import { KeyManagementSystem, MemoryPrivateKeyStore } from "@veramo/kms-local"
import { MemoryDIDStore } from "@veramo/did-manager"
import { DataStoreJson } from "@veramo/data-store-json"

// Agent setup
const agent = createAgent({
  plugins: [
    new KeyManager({
      store: new MemoryPrivateKeyStore(),
      kms: {
        local: new KeyManagementSystem(),
      },
    }),
    new DIDManager({
      store: new MemoryDIDStore(),
      defaultProvider: "did:key",
      providers: {
        "did:key": new KeyDIDProvider(),
      },
    }),
    new DataStoreJson({}),
  ],
})

// Expose messaging API for popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CREATE_DID") {
    ;(async () => {
      const id: IIdentifier = await agent.didManagerCreate()
      console.log("Created DID:", id.did)
      sendResponse({ did: id.did })
    })()
    return true // async response
  }
})*/
