
import React, { useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'

export default function Student() {
  const [offer, setOffer] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createOffer() {
    try {
      setCreating(true); setError(null)
      // Ask backend to create a pre-authorized offer for a demo credential
      // The backend /api/offers endpoint should exist in your codebase (see routes/oid4vci.ts)
      const res = await axios.post(`${API}/offers`, {
        schemaId: 'DemoCredential', // change as needed
        claims: { degree: 'Computer Science', name: 'Student X' }
      })
      setOffer(res.data)
    } catch(e:any) {
      setError(e?.message ?? 'Failed to create offer');
    } finally {
      setCreating(false)
    }
  }

  function claimWithWallet() {
    if (!offer?.credential_offer_uri) return
    // Emit a DOM event that the wallet extension content-script listens to
    window.dispatchEvent(new CustomEvent('oid4vci:claim', {
      detail: { credential_offer_uri: offer.credential_offer_uri }
    } as any))
  }

  return (
    <div style={{fontFamily:'system-ui', maxWidth: 720, margin:'40px auto'}}>
      <h2>🎓 Claim Your Degree Credential</h2>
      {!offer && (
        <button onClick={createOffer} disabled={creating} style={{padding:'10px 16px', borderRadius: 8}}>
          {creating ? 'Preparing...' : 'Prepare Credential Offer'}
        </button>
      )}

      {offer && (
        <div style={{marginTop: 16, padding: 16, border:'1px solid #ddd', borderRadius: 8}}>
          <p><strong>Offer ready.</strong> Click below and your wallet should open.</p>
          <button onClick={claimWithWallet} style={{padding:'10px 16px', borderRadius: 8}}>
            Claim your credential
          </button>
          <p style={{marginTop:12, fontSize: 12, opacity:.7}}>If the wallet doesn't open, install the extension or use the deep link:</p>
          <code style={{display:'block', wordBreak:'break-all', fontSize:12}}>{offer.credential_offer_uri}</code>
        </div>
      )}

      {error && <p style={{color:'crimson'}}>{error}</p>}
    </div>
  )
}
