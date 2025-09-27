
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { createDidKey } from "../did";
import { getDB } from "../db";

function Popup() {
  const [did, setDid] = useState<string>("");

  const handleCreate = async () => {
    const kp = await createDidKey();
    const holderDid = kp.did;

    // persist in DB
    const db = await getDB();
    const stmt = db.prepare("INSERT INTO dids(did, pk, sk) VALUES (?, ?, ?)");
    stmt.run([kp.did, kp.pk, kp.sk]);
    stmt.free();

    setDid(holderDid);
  };

  return (
    <div style={{ padding: "10px", width: "250px" }}>
      <h3>Wallet</h3>
      <button onClick={handleCreate}>Create Holder DID</button>
      {did && (
        <p>
          <strong>Your DID:</strong>
          <br />
          {did}
        </p>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<Popup />);
