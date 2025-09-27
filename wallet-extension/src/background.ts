/// <reference types="chrome" />
import axios from 'axios'
import { getDB, persistDB } from './db'
import { createDidKey } from './did'
import { buildProofJWT } from './proof'

const API_FALLBACK = 'http://localhost:8000/api'

chrome.runtime.onMessage.addListener((
  msg: any,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: any) => void
) => {
  if (msg?.type === 'OID4VCI_START') {
    const { credential_offer_uri } = msg.payload || {}
    if (!credential_offer_uri) return
    startFlow(credential_offer_uri).catch(err => {
      console.error('OID4VCI flow failed', err)
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Wallet Error',
        message: String(err?.message || err)
      })
    })
  }
})


async function startFlow(credential_offer_uri: string) {
  // 1) Fetch the credential offer
  const offerRes = await axios.get(credential_offer_uri)
  const offer = offerRes.data?.credential_offer || offerRes.data
  if (!offer) throw new Error('Invalid credential_offer response')

  const issuerBase = offer.credential_issuer || new URL(credential_offer_uri).origin
  const tokenEndpoint = `${issuerBase}/oid4vci/token`
  const credentialEndpoint = `${issuerBase}/oid4vci/credential`

  const pre = offer?.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']
  if (!pre?.['pre-authorized_code']) throw new Error('No pre-authorized code in offer')
  const preCode = pre['pre-authorized_code']

  // 2) Token (pre-authorized code flow; PIN not used)
  const tokenRes = await axios.post(tokenEndpoint, {
    grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    'pre-authorized_code': preCode,
  })
  const token = tokenRes.data?.access_token
  const c_nonce = tokenRes.data?.c_nonce
  if (!token) throw new Error('No access_token from issuer')

  // 3) Holder DID (create one if needed, persisted in sqlite via sql.js)
  const db = await getDB()
  let holderDid: string | undefined
  let sk: Uint8Array | undefined
  // try to find existing
  const res = db.exec('SELECT did, sk FROM dids LIMIT 1')
  if (res.length && res[0].values.length) {
    holderDid = res[0].values[0][0] as string
    const skBuf = res[0].values[0][1] as Uint8Array
    sk = new Uint8Array(skBuf as any)
  } else {
    const kp = await createDidKey()
    holderDid = kp.did
    sk = kp.sk
    const stmt = db.prepare('INSERT INTO dids(did, pk, sk) VALUES (?, ?, ?)')
    stmt.run([holderDid, kp.pk, kp.sk])
    stmt.free()
    await persistDB()
  }

  // 4) Build proof JWT with c_nonce
  const proofJwt = await buildProofJWT({ holderDid: holderDid!, audience: credentialEndpoint, nonce: c_nonce, sk: sk! })

  // 5) Request credential
  const credRes = await axios.post(credentialEndpoint,
    {
      format: 'jwt_vc',
      proof: { proof_type: 'jwt', jwt: proofJwt },
      // You can scope which credential by ID if your issuer supports it; for demo we assume default
    },
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const vc = credRes.data?.credential || credRes.data
  if (!vc) throw new Error('No credential in response')

  // 6) Persist credential
  db.run('INSERT INTO credentials(issuer, subject, format, vc) VALUES (?, ?, ?, ?)',
    [vc.issuer || vc.iss || 'unknown', holderDid, 'jwt_vc', JSON.stringify(vc)])
  await persistDB()

  chrome.notifications.create({
    type: 'basic', iconUrl: 'icon48.png', title: 'Credential added', message: 'Your credential was stored in the wallet.'
  })
}
