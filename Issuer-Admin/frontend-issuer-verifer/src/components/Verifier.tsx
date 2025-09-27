import { useState } from "react";
import { verifyCredential } from "../api/backend"; // Ensure this function exists in backend.ts

interface VerificationResponse {
  verified: boolean;
  error?: string;
}

const Verifier = () => {
  const [credential, setCredential] = useState("");
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    try {
      const parsedCredential = JSON.parse(credential);
      const response: VerificationResponse = await verifyCredential({ credential: parsedCredential });

      setResult(response);
      setError(""); // Clear errors if verification is successful
    } catch (err) {
      setError("Invalid JSON format. Please enter a valid Verifiable Credential.");
    }
  };

  return (
    <div>
      <h2>Verify Credential</h2>
      <textarea
        placeholder="Paste Verifiable Credential JSON"
        onChange={(e) => setCredential(e.target.value)}
      ></textarea>
      <button onClick={handleVerify}>Verify</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {result && (
        <p>{result.verified ? "✅ Valid Credential" : `❌ Invalid Credential - ${result.error || "Unknown error"}`}</p>
      )}
    </div>
  );
};

export default Verifier;


/*import { useState } from "react";
import { verifyCredential } from "../api/backend";

// ✅ Define the expected verification response type
interface VerificationResponse {
  verified: boolean;
  error?: string;
}

const Verifier = () => {
  const [credential, setCredential] = useState("");
  const [result, setResult] = useState<VerificationResponse | null>(null); // ✅ Define type explicitly

  const handleVerify = async () => {
    try {
      const response: VerificationResponse = await verifyCredential({ credential: JSON.parse(credential) });
      setResult(response);
    } catch (error) {
      setResult({ verified: false, error: "Verification failed" });
    }
  };

  return (
    <div>
      <h2>Verify Credential</h2>
      <textarea onChange={(e) => setCredential(e.target.value)} placeholder="Paste credential JSON"></textarea>
      <button onClick={handleVerify}>Verify</button>
      {result && (
        <p>{result.verified ? "✅ Valid Credential" : `❌ Invalid Credential - ${result.error || "Unknown error"}`}</p>
      )}
    </div>
  );
};

export default Verifier;*/

