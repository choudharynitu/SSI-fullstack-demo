import React, { useState } from "react"
import ReactDOM from "react-dom/client"

function Popup() {
  const [did, setDid] = useState<string>("")

  const handleCreate = () => {
    chrome.runtime.sendMessage({ type: "CREATE_DID" }, (response) => {
      if (response?.did) {
        setDid(response.did)
      }
    })
  }

  return (
    <div style={{ padding: "10px", width: "250px" }}>
      <h3>Veramo Wallet</h3>
      <button onClick={handleCreate}>Create DID</button>
      {did && (
        <p>
          <strong>Your DID:</strong>
          <br />
          {did}
        </p>
      )}
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById("root")!)
root.render(<Popup />)
