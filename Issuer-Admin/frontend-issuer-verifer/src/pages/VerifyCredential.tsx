import Verifier from "../components/Verifier";

const VerifyCredential = () => {
  return (
    <div>
      <h1>Verify a Credential</h1>
      <Verifier />
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
