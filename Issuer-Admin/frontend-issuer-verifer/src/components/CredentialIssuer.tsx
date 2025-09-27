import { useState, useEffect } from "react";
import { issueCredential, getSchemas, getDIDs } from "../api/backend";

// Explicitly define the Schema type
interface Schema {
  $id: string;
  name: string;
  description?: string;
  type: "object";
  properties: {
    [key: string]: { type: "string" | "number" | "boolean" | "object" | "array" };
  };
  required: string[];
}
interface DID {
  did: string;
  provider: string;
}


const CredentialIssuer = () => {
  const [issuerDID, setIssuerDID] = useState("");
  const [subjectDID, setSubjectDID] = useState("");
  const [schemas, setSchemas] = useState<Schema[]>([]); // Explicitly define array type
  const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
  const [dids, setDIDs] = useState<DID[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string | number>>({});


  useEffect(() => {
    const fetchSchemas = async () => {
      const schemaList: { schemas: Schema[] } = await getSchemas();
      setSchemas(schemaList.schemas || []); // Ensure it's an array
    };

    const fetchDIDs = async () => {
      const didList: { dids: DID[] } = await getDIDs();
      setDIDs(didList.dids || []);
    };
    fetchSchemas();
    fetchDIDs();
  }, []);

  const handleSchemaChange = (schemaId: string) => {
    const schema = schemas.find((s) => s.$id === schemaId) || null;
    setSelectedSchema(schema);

    if (schema) {
      // Initialize field values with empty strings
      const initialValues: Record<string, string> = {};
      Object.keys(schema.properties).forEach((field) => {
        initialValues[field] = "";
      });
      setFieldValues(initialValues);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFieldValues((prevValues) => ({
      ...prevValues,
      //[field]: value,
      [field]: selectedSchema?.properties[field].type === "number" ? Number(value) : value,
    }));
  };


  const handleIssueCredential = async () => {
    if (!issuerDID || !subjectDID || !selectedSchema) {
      alert("Please fill in all required fields.");
      return;
    }

    // Ensure all required fields are filled
    for (const field of selectedSchema.required) {
      if (!fieldValues[field]) {
        alert(`Please fill in the required field: ${field}`);
        return;
      }
    }
    const data = {
      issuerDID,
      subjectDID,
      schemaId: selectedSchema.$id,
      credentialSubject: fieldValues, // Include field values
    };
    console.log("Sending credential issuance request:", data); // Debugging log
    const result = await issueCredential(data);
    console.log(result);
    alert("Credential issued successfully!");
  };

  return (
    <div>
      <h2>Issue Credential</h2>

      {/* Select Issuer DID */}
      <label>Issuer DID</label>
      <select onChange={(e) => setIssuerDID(e.target.value)}>
        <option value="">Select an Issuer DID</option>
        {dids.map((did) => (
          <option key={did.did} value={did.did}>
            {did.did} ({did.provider})
          </option>
        ))}
      </select>

      {/* Enter Subject DID */}
      <input type="text" placeholder="Subject DID" onChange={(e) => setSubjectDID(e.target.value)} />

      {/* Select Schema */}
      <label>Schema</label>
      {/* Select Schema */}
      <label>Schema</label>
      <select onChange={(e) => handleSchemaChange(e.target.value)}>
        <option value="">Select Schema</option>
        {schemas.map((schema) => (
          <option key={schema.$id} value={schema.$id}>
            {schema.name}
          </option>
        ))}
      </select>

      {/* Dynamically Generated Fields */}
      {selectedSchema && (
        <div>
          <h3>Enter Values for Schema Fields</h3>
          {Object.entries(selectedSchema.properties).map(([field, fieldData]) => (
            <div key={field}>
              <label>{field}</label>
              <input
                type={fieldData.type === "number" ? "number" : "text"}
                placeholder={`Enter ${field}`}
                value={fieldValues[field] || ""}
                onChange={(e) => handleFieldChange(field, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <button onClick={handleIssueCredential}>Issue</button>
    </div>
  );
};

export default CredentialIssuer;






/*import { useState } from "react";
import { issueCredential } from "../api/backend"; // Ensure this function is correctly implemented

const CredentialIssuer = () => {
  const [issuerDID, setIssuerDID] = useState("");
  const [subjectDID, setSubjectDID] = useState("");
  const [schemaId, setSchemaId] = useState("");
  const [credentialSubject, setCredentialSubject] = useState({});
  const [credential, setCredential] = useState(null);
  const [error, setError] = useState("");

  const handleIssueCredential = async () => {
    try {
      const data = { issuerDID, subjectDID, schemaId, credentialSubject };
      const result = await issueCredential(data);
      if (result.success) {
        setCredential(result.verifiableCredential);
        setError(""); // Clear errors if successful
      } else {
        setError(result.error || "Credential issuance failed.");
      }
    } catch (err) {
      setError("Error issuing credential. Check input and try again.");
    }
  };

  return (
    <div>
      <h2>Issue Credential</h2>
      <input type="text" placeholder="Issuer DID" value={issuerDID} onChange={(e) => setIssuerDID(e.target.value)} />
      <input type="text" placeholder="Subject DID" value={subjectDID} onChange={(e) => setSubjectDID(e.target.value)} />
      <input type="text" placeholder="Schema ID" value={schemaId} onChange={(e) => setSchemaId(e.target.value)} />
      <textarea
        placeholder="Credential Subject JSON"
        onChange={(e) => {
          try {
            setCredentialSubject(JSON.parse(e.target.value));
            setError(""); // Clear error if JSON is valid
          } catch {
            setError("Invalid JSON format");
          }
        }}
      />
      <button onClick={handleIssueCredential}>Issue Credential</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {credential && <pre>{JSON.stringify(credential, null, 2)}</pre>}
    </div>
  );
};

export default CredentialIssuer;

*/
/*import { useState } from "react";
import { issueCredential } from "../api/backend";

const CredentialIssuer = () => {
  const [issuerDID, setIssuerDID] = useState("");
  const [subjectDID, setSubjectDID] = useState("");
  const [schemaId, setSchemaId] = useState("");
  const [credential, setCredential] = useState(null);

  const handleIssueCredential = async () => {
    const data = { issuerDID, subjectDID, schemaId, credentialSubject: {} };
    const result = await issueCredential(data);
    setCredential(result.verifiableCredential);
  };

  return (
    <div>
      <h2>Issue Credential</h2>
      <input type="text" placeholder="Issuer DID" onChange={(e) => setIssuerDID(e.target.value)} />
      <input type="text" placeholder="Subject DID" onChange={(e) => setSubjectDID(e.target.value)} />
      <input type="text" placeholder="Schema ID" onChange={(e) => setSchemaId(e.target.value)} />
      <button onClick={handleIssueCredential}>Issue</button>
      {credential && <pre>{JSON.stringify(credential, null, 2)}</pre>}
    </div>
  );
};

export default CredentialIssuer;*/
