import { useState } from "react";
import Verifier from "../components/Verifier";
import OID4VPVerifier from "../components/OID4VPVerifier";

const VerifyCredential = () => {
  const [verifierType, setVerifierType] = useState<'simple' | 'oid4vp'>('oid4vp');

  return (
    <div>
      <h1>Verify Credentials</h1>

      <div className="verifier-selector">
        <button
          className={verifierType === 'simple' ? 'active' : ''}
          onClick={() => setVerifierType('simple')}
        >
          Simple Verification
        </button>
        <button
          className={verifierType === 'oid4vp' ? 'active' : ''}
          onClick={() => setVerifierType('oid4vp')}
        >
          OID4VP Verifier
        </button>
      </div>

      <div className="verifier-content">
        {verifierType === 'simple' ? (
          <div>
            <h2>Direct Credential Verification</h2>
            <p>Paste a credential JSON or JWT to verify it directly.</p>
            <Verifier />
          </div>
        ) : (
          <div>
            <h2>OpenID4VP Verifier</h2>
            <p>Create presentation requests and verify credentials using the OpenID4VP standard.</p>
            <OID4VPVerifier />
          </div>
        )}
      </div>

      <style jsx>{`
        .verifier-selector {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 2px solid #ddd;
          padding-bottom: 10px;
        }

        .verifier-selector button {
          padding: 10px 20px;
          border: none;
          background: #f8f9fa;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .verifier-selector button.active {
          background: #007bff;
          color: white;
        }

        .verifier-selector button:hover {
          background: #e9ecef;
        }

        .verifier-selector button.active:hover {
          background: #0056b3;
        }

        .verifier-content {
          margin-top: 20px;
        }

        .verifier-content h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .verifier-content p {
          color: #666;
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  );
};

export default VerifyCredential;


/*import { useState } from "react";

const VerifyCredential = () => {
  const [credential, setCredential] = useState("");
  const [verificationResult, setVerificationResult] = useState("");

  const handleVerifyCredential = async () => {
    const response = await fetch("http://localhost:8000/api/credentials/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: JSON.parse(credential) }),
    });

    const data = await response.json();
    setVerificationResult(JSON.stringify(data.result, null, 2));
  };

  return (
    <div>
      <h2>Verify Credential</h2>
      <textarea placeholder="Paste Verifiable Credential JSON" onChange={(e) => setCredential(e.target.value)} />
      <button onClick={handleVerifyCredential}>Verify</button>
      {verificationResult && <pre>{verificationResult}</pre>}
    </div>
  );
};

export default VerifyCredential; */
