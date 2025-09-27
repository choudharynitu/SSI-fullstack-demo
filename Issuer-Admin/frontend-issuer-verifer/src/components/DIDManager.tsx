import { useState, useEffect } from "react";
import { createDID, getDIDs, resolveDID } from "../api/backend"; // Ensure resolveDID is implemented
import styles from './DIDManager.module.css';

const DIDManager = () => {
  const [provider, setProvider] = useState("did:key");
  const [dids, setDIDs] = useState<{ did: string; provider: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedOption, setSelectedOption] = useState("list"); // Default to listing DIDs
  const [resolveDIDInput, setResolveDIDInput] = useState("");
  const [resolvedDID, setResolvedDID] = useState(null);
  const [createdDID, setCreatedDID] = useState(null);


  useEffect(() => {
    if (selectedOption === "list") {
      fetchDIDs();
    }
  }, [selectedOption]);

  const fetchDIDs = async () => {
    setLoading(true);
    setError("");
    
      try {
        const response = await getDIDs();
        if (response && Array.isArray(response.dids)) {
          setDIDs(response.dids);
        } else {
          setDIDs([]);
          console.warn("getDIDs returned invalid structure", response);
        }
      } catch (error) {
        setError("Error fetching identifiers. Try again.");
        console.error("Fetch DIDs Error:", error);
        setDIDs([]);
      }
    setLoading(false);
  };

  const handleCreateDID = async () => {
    setLoading(true);
    setError("");
   
      try {
        const newDID = await createDID(provider);
        if (newDID && newDID.did) {
          setCreatedDID(newDID);
          await fetchDIDs();
        } else {
          setError("Failed to create identifier.");
        }
      } catch (error) {
        setError("Error creating identifier. Please try again.");
        console.error("Create DID Error:", error);
      }
    setLoading(false);
  };

  const handleResolveDID = async () => {
    setLoading(true);
    setResolvedDID(null);
    setError("");

    try {
      const resolvedData = await resolveDID(resolveDIDInput);
      if (resolvedData) {
        setResolvedDID(resolvedData);
      } else {
        setError("DID not found or resolution failed.");
      }
    } catch (error) {
      setError("Error resolving DID. Please try again.");
      console.error("Resolve DID Error:", error);
    }
    setLoading(false);
  };

  return (
    <div className={styles.didManagerContainer}>
      <div className={styles.controlsPanel}>
        <h2>Identifiers</h2>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <div className="tab-menu">
          <button onClick={() => setSelectedOption("create")}>➕ Create New Identifier</button>
          <button onClick={() => setSelectedOption("list")}>📜 List Existing Identifiers</button>
          <button onClick={() => setSelectedOption("resolve")}>🔍 Resolve a DID</button>
        </div>

        {selectedOption === "create" && (
          <div>
            <h3>Create a New Identifier</h3>
            <label>Select Provider:</label>
            <select onChange={(e) => setProvider(e.target.value)} value={provider}>
              <option value="did:key">did:key</option>
              <option value="did:web">did:web</option>
              <option value="did:ethr">did:ethr</option>
              <option value="did:cheqd:testnet">did:cheqd:testnet</option>
            </select>
            <button onClick={handleCreateDID} disabled={loading}>
              {loading ? "Creating..." : "Create Identifier"}
            </button>
          </div>
        )}

        {selectedOption === "resolve" && (
          <div>
            <h3>Resolve a DID</h3>
            <input
              type="text"
              placeholder="Enter DID"
              value={resolveDIDInput}
              onChange={(e) => setResolveDIDInput(e.target.value)}
            />
            <button onClick={handleResolveDID} disabled={loading || !resolveDIDInput}>
              {loading ? "Resolving..." : "Resolve DID"}
            </button>

            
          </div>
        )}
      </div>

      <div className={styles.didsListPanel}>
  {selectedOption === "list" && (
    <>
      <h3>Existing Identifiers</h3>
      {loading && <p>Loading...</p>}
      {dids.length > 0 ? (
        <ul>
          {dids.map((did, index) => (
            <li key={index}>
              <strong>{did.did}</strong> ({did.provider})
            </li>
          ))}
        </ul>
      ) : (
        <p>No identifiers found.</p>
      )}
    </>
  )}

{selectedOption === "resolve" && resolvedDID && (
  <>
    <h3>Resolved DID Document</h3>
    <div className={styles.didDocumentBox}>
      <pre>{JSON.stringify(resolvedDID, null, 2)}</pre>
    </div>
  </>
)}
{selectedOption === "create" && createdDID && (
          <>
            <h3>Created DID Document</h3>
            <div className={styles.didDocumentBox}>
              <pre>{JSON.stringify(createdDID, null, 2)}</pre>
            </div>
          </>
        )}

</div>
    </div>
  );
};

export default DIDManager;

/* Add this to your CSS */
/*
.did-manager-container {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.controls-panel {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  width: 300px;
}

.dids-list-panel {
  background: #1e1e1e;
  color: white;
  padding: 1rem;
  border-radius: 8px;
  flex-grow: 1;
}
*/





