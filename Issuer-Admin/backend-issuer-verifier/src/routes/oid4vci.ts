import { Router, Request, Response } from 'express'
import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { agent } from '../agent.js'

// NEW: schema + PoP support
import fs from 'fs'
import path from 'path'
import Ajv from 'ajv'
import { fileURLToPath } from 'url'
import { Resolver } from 'did-resolver'
//import { getResolver as keyDidResolver } from 'key-did-resolver'
import { getDidKeyResolver as keyDidResolver } from '@veramo/did-provider-key';
import { verifyJWT } from 'did-jwt'

export const router = Router()

// ---------- DB ----------
const dbPath = process.env.DB_PATH ?? './data/ssi.sqlite'
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// Ensure base tables exist (schemas table likely already present from your original code)
db.exec(`
  
  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    pre_authorized_code TEXT UNIQUE,
    user_pin TEXT,
    schema_id TEXT,
    claims TEXT,
    created_at INTEGER,
    status TEXT
  );
  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    offer_id TEXT,
    created_at INTEGER,
    expires_at INTEGER,
    c_nonce TEXT,
    c_nonce_expires_at INTEGER
  );
`)

// Add missing columns if tables already existed with older layout
function haveCols(table: string): string[] {
  return db.prepare(`PRAGMA table_info('${table}')`).all().map((r: any) => r.name)
}
function addCol(table: string, colDef: string, name: string) {
  const cols = haveCols(table)
  if (!cols.includes(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`)
  }
}
addCol('offers', 'user_pin TEXT', 'user_pin')
addCol('offers', 'schema_id TEXT', 'schema_id')
addCol('offers', 'claims TEXT', 'claims')
addCol('offers', 'created_at INTEGER', 'created_at')
addCol('offers', 'status TEXT', 'status')
addCol('tokens', 'c_nonce TEXT', 'c_nonce')
addCol('tokens', 'c_nonce_expires_at INTEGER', 'c_nonce_expires_at')

// ---------- Utilities ----------
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const schemaFilePath = path.join(__dirname, '../data/schemas.json')

type JsonSchema = any
type StoredSchema = {
  $id: string
  name: string
  version?: string
  [k: string]: any
}

function loadSchemas(): StoredSchema[] {
  if (!fs.existsSync(schemaFilePath)) return []
  try {
    return JSON.parse(fs.readFileSync(schemaFilePath, 'utf-8'))
  } catch {
    return []
  }
}

function issuerBaseUrl (req: Request): string {
  const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || 'localhost:4000'
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http'
  // If you mount under /api from index.ts, include /api here
  return `${proto}://${host}/api`
}

const resolver = new Resolver({ ...keyDidResolver() })

// ---------- OIDC metadata ----------
router.get('/.well-known/openid-credential-issuer', async (req: Request, res: Response) => {
  const base = issuerBaseUrl(req)
  res.json({
    credential_issuer: base,
    credential_endpoint: `${base}/oid4vci/credential`,
    token_endpoint: `${base}/oid4vci/token`,
    authorization_server: `${base}`, // not used in pre-authorized
    // You could add credential_configurations_supported here if you publish them
    credentials_supported: [
      {
        format: 'jwt_vc',
        types: ['VerifiableCredential', 'DemoCredential'],
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256K'],
        display: [{ name: 'Demo Credential', locale: 'en-US' }]
      }
    ]
  })
})

// ---------- Create Offer (admin) ----------
// NOTE: Do NOT pass subject DID here; holder DID comes later in /credential.
router.post('/offers', async (req: Request, res: Response) => {
  const { schemaId, claims, userPin } = req.body ?? {}
  if (!schemaId || !claims) {
    return res.status(400).json({ error: 'schemaId and claims are required' })
  }

  // Accept either schema $id or schema name from the UI
  const all = loadSchemas()
  const schema = all.find(s => s.$id === schemaId || s.name === schemaId)
  if (!schema) return res.status(400).json({ error: 'schema_not_found' })

  const storeSchemaId = schema.$id // always store the real $id

  // ✅ declare these BEFORE using them
  const id = nanoid()
  const pre = nanoid(32)

  // Insert (support legacy column subject_did if present)
  const cols = db.prepare(`PRAGMA table_info('offers')`).all().map((r: any) => r.name)
  if (cols.includes('subject_did')) {
    db.prepare(`
      INSERT INTO offers (id, pre_authorized_code, user_pin, schema_id, claims, created_at, status, subject_did)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(id, pre, userPin ?? null, storeSchemaId, JSON.stringify(claims), Date.now(), 'created', '')
  } else {
    db.prepare(`
      INSERT INTO offers (id, pre_authorized_code, user_pin, schema_id, claims, created_at, status)
      VALUES (?,?,?,?,?,?,?)
    `).run(id, pre, userPin ?? null, storeSchemaId, JSON.stringify(claims), Date.now(), 'created')
  }

  const base = issuerBaseUrl(req)
  const credential_offer_uri = `${base}/oid4vci/credential-offer?offer_id=${id}`

  res.json({ id, credential_offer_uri })
})


/*router.post('/offers', async (req: Request, res: Response) => {
  const { schemaId, claims, userPin } = req.body ?? {}
  if (!schemaId || !claims) {
    return res.status(400).json({ error: 'schemaId and claims are required' })
  }
  const id = nanoid()
  const pre = nanoid(32)

  db.prepare(`INSERT INTO offers (id, pre_authorized_code, user_pin, schema_id, claims, created_at, status)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, pre, userPin ?? null, schemaId, JSON.stringify(claims), Date.now(), 'created')

  const base = issuerBaseUrl(req)
  const credential_offer_uri = `${base}/oid4vci/credential-offer?offer_id=${id}`

  res.json({
    id,
    credential_offer_uri
  })
})
*/

// ---------- GET credential-offer (dereferenced by wallet) ----------
router.get('/oid4vci/credential-offer', (req: Request, res: Response) => {
  const offer_id = String(req.query.offer_id || '')
  if (!offer_id) return res.status(400).json({ error: 'offer_id required' })
  const row = db.prepare('SELECT * FROM offers WHERE id = ?').get(offer_id)
  if (!row) return res.status(404).json({ error: 'offer not found' })

  const base = issuerBaseUrl(req)
  res.json({
    credential_issuer: base,
    credential_configuration_ids: [row.schema_id],
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': row.pre_authorized_code,
        'user_pin_required': !!row.user_pin
      }
    }
  })
})

// ---------- Token endpoint (returns c_nonce for PoP) ----------
router.post('/oid4vci/token', (req: Request, res: Response) => {
  const { grant_type, 'pre-authorized_code': preCode, user_pin } = req.body ?? {}
  if (grant_type !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' })
  }
  if (!preCode) return res.status(400).json({ error: 'pre-authorized_code required' })

  const offer = db.prepare('SELECT * FROM offers WHERE pre_authorized_code = ?').get(preCode)
  if (!offer) return res.status(400).json({ error: 'invalid_grant' })

  if (offer.user_pin && String(offer.user_pin) !== String(user_pin ?? '')) {
    return res.status(400).json({ error: 'invalid_user_pin' })
  }

  const token = nanoid(48)
  const now = Math.floor(Date.now()/1000)
  const expires_in = 300 // 5 minutes
  const c_nonce = nanoid(24)
  const c_nonce_expires_in = 600 // 10 minutes

  db.prepare(`INSERT INTO tokens (token, offer_id, created_at, expires_at, c_nonce, c_nonce_expires_at)
              VALUES (?,?,?,?,?,?)`)
    .run(token, offer.id, now, now + expires_in, c_nonce, now + c_nonce_expires_in)

  res.json({
    access_token: token,
    token_type: 'bearer',
    expires_in,
    c_nonce,
    c_nonce_expires_in
  })
})

// ---------- Credential endpoint (verify PoP + issue JWT VC) ----------
router.post('/oid4vci/credential', async (req: Request, res: Response) => {
  // 1) Bearer token
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'invalid_token' })

  const tok = db.prepare('SELECT * FROM tokens WHERE token = ?').get(token)
  if (!tok) return res.status(401).json({ error: 'invalid_token' })
  const now = Math.floor(Date.now()/1000)
  if (tok.expires_at && now > tok.expires_at) return res.status(401).json({ error: 'token_expired' })

  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(tok.offer_id)
  if (!offer) return res.status(400).json({ error: 'offer_not_found' })

  // 2) Request body
  const { type, format, proof, credential_subject } = req.body ?? {}
  if (format !== 'jwt_vc') return res.status(400).json({ error: 'unsupported_format' })
  if (!type) return res.status(400).json({ error: 'type required' })
  if (!credential_subject?.id) return res.status(400).json({ error: 'credential_subject.id required' })
  if (!proof?.proof_type || !proof?.jwt) return res.status(400).json({ error: 'proof.jwt required' })

  // 3) Verify PoP JWT (did:key)
  const base = issuerBaseUrl(req)
  try {
    const verification = await verifyJWT(proof.jwt, { resolver, audience: base })
    const payload: any = verification.payload
    const holderDid = verification.issuer
    if (payload.iss !== holderDid || payload.sub !== holderDid) {
      return res.status(400).json({ error: 'iss_sub_mismatch' })
    }
    if (!tok.c_nonce || payload.nonce !== tok.c_nonce) {
      return res.status(400).json({ error: 'invalid_nonce' })
    }
    if (holderDid !== credential_subject.id) {
      return res.status(400).json({ error: 'subject_mismatch' })
    }
    if (payload.exp && payload.exp < now) {
      return res.status(400).json({ error: 'proof_expired' })
    }
  } catch (e: any) {
    return res.status(400).json({ error: 'invalid_proof', detail: String(e?.message || e) })
  }

  // 4) Load schema + validate claims from the offer
const schemas = loadSchemas();
const schema = schemas.find(s => s.$id === offer.schema_id);
if (!schema) return res.status(400).json({ error: 'schema_not_found' });

const ajv = new Ajv({ strict: false }); // tolerate minor schema loosening if needed
const { name, ...jsonSchema } = schema as any;
// Tell TS the data we validate is a plain object
const validate = ajv.compile<Record<string, unknown>>(jsonSchema as Record<string, unknown>);

// Parse claims and make sure it's a plain object before we spread it
const parsed = offer.claims ? JSON.parse(offer.claims) : {};
const claims: Record<string, unknown> =
  parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};

const ok = validate(claims);
if (!ok) return res.status(400).json({ error: 'claims_invalid', details: validate.errors });

// 5) Build VC using schema.name as the second type
const issuerDid = (await agent.didManagerGetOrCreate({ alias: 'issuer', provider: 'did:key' })).did;
const vc: any = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential', name || type],
  issuer: issuerDid,
  issuanceDate: new Date().toISOString(),
  credentialSubject: { id: credential_subject.id, ...claims } // safe now
};

// 6) Sign (JWT VC)
const verifiable = await agent.createVerifiableCredential({
  credential: vc as any,
  proofFormat: 'jwt'
});

// 6b) Persist the issued VC in Veramo's DataStore (Option A)
try {
  // Veramo accepts the JWT string or the VC object depending on your proofFormat.
  const toStore = (typeof verifiable === 'string') ? verifiable : (verifiable as any)
  await agent.dataStoreSaveVerifiableCredential({
    verifiableCredential: toStore
  })
  console.log('[OID4VCI] Saved issued VC in Veramo DataStore')
} catch (e) {
  // Non-fatal: even if saving fails, you can still return the VC to the wallet
  console.warn('[OID4VCI] Could not save VC in DataStore:', e)
}
  // Optional: clear nonce to prevent replay
  db.prepare('UPDATE tokens SET c_nonce = NULL, c_nonce_expires_at = NULL WHERE token = ?').run(token)

  res.json({ format: 'jwt_vc', credential: verifiable })
})

export default router


/*
import { Router, Request, Response } from 'express'
import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { agent } from '../agent.js'

//
 //OID4VCI pre-authorized code flow (Issuer side)
 //Endpoints mounted under /api (index.ts)
 //  GET    /.well-known/openid-credential-issuer
 //  POST   /offers
 //  GET    /oid4vci/credential-offer
 //  POST   /oid4vci/token
 //  POST   /oid4vci/credential
 //

export const router = Router()

// We use a simple SQLite (better-sqlite3) store for schemas, offers, tokens.
const dbPath = process.env.DB_PATH ?? './data/ssi.sqlite'
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS schemas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    pre_authorized_code TEXT,
    user_pin TEXT,
    schema_id TEXT NOT NULL,
    subject_did TEXT NOT NULL,
    claims TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

function issuerBaseUrl(req: Request) {
  // The backend mounts /api; ensure our returned URLs include that base
  const host = process.env.ISSUER_HOST ?? req.hostname ?? 'localhost'
  const port = process.env.PORT ?? process.env.ISSUER_PORT ?? '4000'
  const proto = req.protocol || 'http'
  const baseNoApi = `${proto}://${host}:${port}`
  return `${baseNoApi}/api`
}

// ----- OIDC issuer metadata -----
router.get('/.well-known/openid-credential-issuer', async (req: Request, res: Response) => {
  // For local dev, prefer did:key so we don't need to host did:web
  const base = issuerBaseUrl(req)
  res.json({
    credential_issuer: base,
    credential_endpoint: `${base}/oid4vci/credential`,
    token_endpoint: `${base}/oid4vci/token`,
    authorization_server: `${base}`, // not used in pre-authorized
    display: [{ name: 'Demo Issuer', locale: 'en-US' }],
    credentials_supported: [
      {
        format: 'jwt_vc',
        types: ['VerifiableCredential', 'DemoCredential'],
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['EdDSA', 'ES256K'],
        display: [{ name: 'Demo Credential', locale: 'en-US' }]
      }
    ]
  })
})

// ----- Create Credential Offer (pre-authorized) -----
router.post('/offers', (req: Request, res: Response) => {
  const { schemaId, subjectDid, claims, userPin } = req.body ?? {}
  if (!schemaId || !subjectDid || !claims) {
    res.status(400).json({ error: 'schemaId, subjectDid, claims required' })
    return
  }
  const offerId = nanoid()
  const preCode = nanoid()
  const stmt = db.prepare('INSERT INTO offers (id,pre_authorized_code,user_pin,schema_id,subject_did,claims) VALUES (?,?,?,?,?,?)')
  stmt.run(offerId, preCode, userPin ?? null, schemaId, subjectDid, JSON.stringify(claims))

  const base = issuerBaseUrl(req)
  const credential_offer = {
    credential_issuer: `${base}`,
    credentials: ['DemoCredential'],
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': preCode,
        user_pin_required: !!userPin
      }
    }
  }
  const offer_uri = `${base}/oid4vci/credential-offer?offer_id=${offerId}`
  res.json({ offer_id: offerId, credential_offer, credential_offer_uri: offer_uri })
})

// Serve the credential_offer by id
router.get('/oid4vci/credential-offer', (req: Request, res: Response) => {
  const { offer_id } = req.query as any
  if (!offer_id) return res.status(400).json({ error: 'offer_id missing' })
  const row = db.prepare('SELECT * FROM offers WHERE id = ?').get(offer_id)
  if (!row) return res.status(404).json({ error: 'offer not found' })

  const base = issuerBaseUrl(req)
  const credential_offer = {
    credential_issuer: `${base}`,
    credentials: ['DemoCredential'],
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': row.pre_authorized_code,
        user_pin_required: !!row.user_pin
      }
    }
  }
  res.json(credential_offer)
})

// ----- Token endpoint (pre-authorized code -> access token) -----
router.post('/oid4vci/token', (req: Request, res: Response) => {
  const { grant_type, 'pre-authorized_code': preCode, user_pin } = req.body ?? {}
  if (grant_type !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
    return res.status(400).json({ error: 'unsupported grant_type' })
  }
  const row = db.prepare('SELECT * FROM offers WHERE pre_authorized_code = ?').get(preCode)
  if (!row) return res.status(400).json({ error: 'invalid pre-authorized_code' })
  if (row.user_pin && row.user_pin !== user_pin) return res.status(400).json({ error: 'invalid user_pin' })

  const token = nanoid()
  db.prepare('INSERT INTO tokens (token,offer_id) VALUES (?,?)').run(token, row.id)
  res.json({ access_token: token, token_type: 'bearer', expires_in: 600 })
})

// ----- Credential endpoint -----
router.post('/oid4vci/credential', async (req: Request, res: Response) => {
  const auth = req.headers.authorization
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' })
  }
  const token = auth.split(' ')[1]
  const tokRow = db.prepare('SELECT * FROM tokens WHERE token = ?').get(token)
  if (!tokRow) return res.status(401).json({ error: 'invalid token' })
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(tokRow.offer_id)
  if (!offer) return res.status(400).json({ error: 'offer not found' })

  // TODO: Validate req.body.proof is a DID-bound JWS (PoP). Skipped in this demo.

  const now = new Date().toISOString()
  const vc = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'DemoCredential'],
    issuer: (await agent.didManagerGetOrCreate({ alias: 'issuer', provider: 'did:key' })).did,
    issuanceDate: now,
    credentialSubject: {
      id: offer.subject_did,
      ...(JSON.parse(offer.claims || '{}'))
    }
  }

  const verifiable = await agent.createVerifiableCredential({
    credential: vc as any,
    proofFormat: 'jwt',
  })

  res.json({
    format: 'jwt_vc',
    credential: verifiable
  })
})

export default router
*/
