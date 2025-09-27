import { Router, Request, Response } from 'express';
import { agent }from '../agent.js';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { fileURLToPath } from 'url';

import { createVerifiableCredentialJwt, Issuer} from 'did-jwt-vc';
import base64url from 'base64url'
import { createJWS } from 'did-jwt'
import { IKey } from '@veramo/core';



export const router = Router();

// Path to stored schemas
//const schemaFilePath = path.join(__dirname, '../data/schemas.json');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaFilePath = path.join(__dirname, '../data/schemas.json');
console.log(schemaFilePath);

const vcDirectory = path.join(__dirname, '../issued-vc-jwts')
if (!fs.existsSync(vcDirectory)) {
    fs.mkdirSync(vcDirectory, { recursive: true })
}

// Load schemas from the file system
const loadSchemas = (): Record<string, any>[] => {
  if (fs.existsSync(schemaFilePath)) {
    return JSON.parse(fs.readFileSync(schemaFilePath, 'utf-8'));
  }
  return [];
};

// Helper to encode Jose Blob (header or payload to base64url string)
function encodeJoseBlob(input: object): string {
  return base64url.encode(JSON.stringify(input))
}


// Issue a credential with schema validation
router.post('/issue', async (req: Request, res: Response): Promise<void> => {
  const { issuerDID, subjectDID, credentialSubject, schemaId } = req.body as {
    issuerDID: string;
    subjectDID: string;
    credentialSubject: Record<string, any>;
    schemaId: string;
  };

  try {
    // Load the schema by schemaId
    const schemas = loadSchemas();
    const schema = schemas.find((s) => s.$id === schemaId);
    console.log("Loaded Schemas:", JSON.stringify(loadSchemas(), null, 2));

    if (!schema) {
      res.status(400).json({ success: false, message: 'Schema not found' });
      return;
    }

    // Remove "name" before validation
    const { name, ...validSchema } = schema; // ✅ Exclude `name`

   // ✅ Ensure schema follows valid JSON Schema format
   if (!schema.properties || !schema.required) {
    res.status(400).json({ success: false, message: "Invalid schema format" });
    return;
  }


    // Validate credentialSubject against the schema
    const ajv = new Ajv();
    const validate = ajv.compile(validSchema);
    if (!validate(credentialSubject)) {
      res.status(400).json({
        success: false,
        message: 'Credential subject does not match schema',
        errors: validate.errors,
      });
      return;
    }

    // Construct the Verifiable Credential
    const credential = {
      "@context": ["https://www.w3.org/2018/credentials/v1","http://schema.org", "https://www.w3.org/2018/credentials/examples/v1", "../data/schemas.json"],
      "id": `urn:uuid:${crypto.randomUUID()}`,
      type: ["VerifiableCredential", schema.name],
      issuer: { id: issuerDID },
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: subjectDID,
        ...credentialSubject,
      },
    };
    console.log("Loaded Schema:", JSON.stringify(schema, null, 2));
    console.log("Received Credential Subject:", JSON.stringify(credentialSubject, null, 2));

    // Issue  Verifiable Credential-proofformat:jwt
    const verifiableCredential = await agent.createVerifiableCredential({
      credential,
      proofFormat: "jwt", // Use "jwt" or "lds" depending on your requirement
    });
    //Issue VC proofformat:lds(JSON-LD signature)
    /*const verifiableCredential = await agent.createVerifiableCredential({
      credential,
      proofFormat: "lds", // ✅ Use JSON-LD signatures
      proofOptions: {
       // verificationMethod: `${issuerDID}#controllerKey`, // Explicitly reference a key
       verificationMethod: `${issuerDID}`,
       // verificationMethod: `${issuerDID}#${issuerDID.split(':')[2]}`,
       // type: "JsonWebSignature2020", // ✅ Use Linked Data Proofs
       type: "Ed25519Signature2020",
       proofPurpose: "verificationMethod",
      // proofPurpose: "assertionMethod",
      },
    });*/
    
    // ✅ Store VC in SQLite database
    console.log("Storing credential in database:", verifiableCredential); // Debugging log
    await agent.dataStoreSaveVerifiableCredential({ verifiableCredential });


    res.json({ success: true, verifiableCredential });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error as Error).message || "An error occurred while issuing the credential",
    });
  }
});

//List stored Credentials
router.get('/list', async (req: Request, res: Response) => {
  try {
    const credentials = await agent.dataStoreORMGetVerifiableCredentials();
    res.json({ success: true, credentials });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Verify a credential
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const { credential } = req.body as { credential: Record<string, any> };

  try {
    const result = await agent.verifyCredential({
      credential: credential as any,
    });

    res.json({ success: true, result });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: (error as Error).message || "An error occurred while verifying the credential",
    });
  }
});
const getAlgFromVerificationMethod = (type: string): string => {
  switch (type) {
      case 'Ed25519VerificationKey2018':
      case 'JsonWebKey2020': // Common for did:key and some others
      case 'Ed25519VerificationKey2020':
          return 'EdDSA';
      case 'EcdsaSecp256k1VerificationKey2019':
          return 'ES256K';
      case 'EcdsaSecp256r1VerificationKey2019':
      case 'JsonWebKey2020': // can also be P-256
          return 'ES256';
      default:
          throw new Error(`Unsupported verificationMethod type: ${type}`);
  }
};

// 🛠️ `/issuevcjwt` handler using Veramo's keyManagerSign and low-level createJWS
router.post('/issuevcjwt', async (req: Request, res: Response) => {
  const { issuerDID, subjectDID, credentialSubject, schemaId } = req.body as {
      issuerDID: string;
      subjectDID: string;
      credentialSubject: Record<string, any>;
      schemaId: string;
  }

  try {
      // Load schema
      const schemas = loadSchemas()
      const schema = schemas.find(s => s.$id === schemaId)
      if (!schema) {
          res.status(400).json({ success: false, message: 'Schema not found' })
          return
      }

      const { name, ...validSchema } = schema

      const ajv = new Ajv()
      const validate = ajv.compile(validSchema)
      if (!validate(credentialSubject)) {
          res.status(400).json({ success: false, message: 'Credential subject does not match schema', errors: validate.errors })
          return
      }

      // Resolve DID document
      const didDocument = await agent.resolveDid({ didUrl: issuerDID })
      if (!didDocument.didDocument) {
          throw new Error(`Unable to resolve DID document for ${issuerDID}`)
      }

      // Extract verification method from DID Document
      const verificationMethod = didDocument.didDocument.verificationMethod?.[0]
      if (!verificationMethod) {
          throw new Error(`No verification method found for ${issuerDID}`)
      }

      // Find corresponding key in Veramo (this ensures Veramo can sign with this key)
      const identifier = await agent.didManagerGet({ did: issuerDID })
      const signingKey = identifier.keys.find((k: IKey) => verificationMethod.id.endsWith(k.kid))

      if (!signingKey) {
          res.status(400).json({ success: false, message: `No signing key found for DID: ${issuerDID}` })
          return
      }

      // Prepare JWT Header
      const alg = signingKey.type === 'Ed25519' ? 'EdDSA' : 'ES256K'
      const header = { alg, typ: 'JWT' }

      // Prepare JWT Payload (VC as JWT)
      const payload = {
          iss: issuerDID,
          sub: subjectDID,
          nbf: Math.floor(Date.now() / 1000),
          vc: {
              '@context': ['https://www.w3.org/2018/credentials/v1'],
              type: ['VerifiableCredential', schema.name],
              credentialSubject,
          },
      }

      // Sign JWT using Veramo's keyManagerSign
      const signingInput = `${encodeJoseBlob(header)}.${encodeJoseBlob(payload)}`
      const signature = await agent.keyManagerSign({
          keyRef: signingKey.kid,
          algorithm: alg,
          data: signingInput,
      })

      const vcJwt = `${signingInput}.${signature}`

      console.log('Issued VC-JWT:', vcJwt)

      // Save VC-JWT to file
      const filePath = path.join(vcDirectory, `${schema.name}-${Date.now()}.jwt`)
      fs.writeFileSync(filePath, vcJwt)

      res.json({ success: true, vcJwt, filePath })
  } catch (error: unknown) {
      console.error('Error issuing VC-JWT:', error)
      res.status(500).json({ success: false, error: (error as Error).message })
  }
})



// 🚀 `/issuevcjwt` using did-jwt-vc and Veramo's keyManagerSign()

/*router.post('/issuevcjwt', async (req: Request, res: Response) => {
  const { issuerDID, subjectDID, credentialSubject, schemaId } = req.body as {
    issuerDID: string;
    subjectDID: string;
    credentialSubject: Record<string, any>;
    schemaId: string;
  };

  try {
      const schemas = loadSchemas()
      const schema = schemas.find(s => s.$id === schemaId)

      if (!schema) {
          res.status(400).json({ success: false, message: 'Schema not found' })
          return
      }
      
      // Remove "name" before validation
    const { name, ...validSchema } = schema; // ✅ Exclude `name`

      const ajv = new Ajv()
      const validate = ajv.compile(validSchema)
      if (!validate(credentialSubject)) {
          res.status(400).json({ success: false, message: 'Credential subject does not match schema', errors: validate.errors })
          return
      }

      // ✅ Resolve the DID Document to find the right verificationMethod (public key)
      const didDocument = await agent.resolveDid({ didUrl: issuerDID })
      //const keys = await agent.keyManagerList()
      const keys = await agent.execute('keyManagerList', {})

      const key = keys.find((k: IKey) => 
          didDocument.didDocument?.verificationMethod?.some(vm => vm.id.includes(k.kid))
      )

      if (!key) {
          res.status(400).json({ success: false, message: `No key found for DID: ${issuerDID}` })
          return
      }

      // ✅ Build proper JwtCredentialPayload (no top-level @context, type, etc.)
      const credentialPayload = {
          sub: subjectDID,
          iss: issuerDID,
          nbf: Math.floor(Date.now() / 1000),  // Unix timestamp, "not before"
          vc: {
              '@context': ['https://www.w3.org/2018/credentials/v1'],
              type: ['VerifiableCredential', schema.name],
              credentialSubject
          }
      }
      // Dynamically detect algorithm based on verificationMethod type
      const verificationMethod = didDocument.didDocument?.verificationMethod?.find(vm => vm.id.includes(key.kid))
      const alg = verificationMethod?.type === 'EcdsaSecp256k1VerificationKey2019' ? 'ES256K' : 'EdDSA'


      // ✅ Define jwtSigner to use Veramo's keyManagerSign
      const jwtSigner = async (data: string | Uint8Array) => {
          const dataStr = typeof data === 'string' ? data : Buffer.from(data).toString('utf-8')

          return await agent.keyManagerSign({
              keyRef: key.kid,
              //algorithm: 'EdDSA',  // Ensure your key type supports EdDSA!
              algorithm: alg,
              data: dataStr,
          })
      }

      const issuer: Issuer = {
          did: issuerDID,
          signer: jwtSigner,
          //alg: 'EdDSA'
          alg
      }

      // ✅ Create VC-JWT
      const vcJwt = await createVerifiableCredentialJwt(credentialPayload, issuer)

      console.log('Issued VC-JWT:', vcJwt)

      // ✅ Save to file
      const filePath = path.join(vcDirectory, `${schema.name}-${Date.now()}.jwt`)
      fs.writeFileSync(filePath, vcJwt)

      res.json({ success: true, vcJwt, filePath })
  } catch (error) {
      console.error('Error issuing VC-JWT:', error)
      res.status(500).json({ success: false, error: (error as Error).message })
  }
})*/


export default router;