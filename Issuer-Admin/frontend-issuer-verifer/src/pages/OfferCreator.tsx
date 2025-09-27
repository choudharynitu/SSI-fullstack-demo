import { useEffect, useMemo, useState } from 'react';
import { createOffer, getSchemas } from '../api/backend';

type JsonSchema = {
  $id: string;
  name: string;
  description?: string;
  type: 'object';
  properties: Record<string, { type: 'string' | 'number' | 'boolean' }>;
  required?: string[];
};

export default function OfferCreator() {
  const [schemas, setSchemas] = useState<JsonSchema[]>([]);
  const [schemaId, setSchemaId] = useState('');
  const [claims, setClaims] = useState<Record<string, any>>({});
  const [userPin, setUserPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ id: string; credential_offer_uri: string } | null>(null);
  const selectedSchema = useMemo(() => schemas.find(s => s.$id === schemaId), [schemas, schemaId]);

  useEffect(() => {
    getSchemas().then(setSchemas).catch(console.error);
  }, []);

  // When schema changes, initialize claims with blanks
  useEffect(() => {
    if (!selectedSchema) return;
    const init: Record<string, any> = {};
    Object.keys(selectedSchema.properties || {}).forEach(k => (init[k] = ''));
    setClaims(init);
  }, [selectedSchema]);

  const handleClaimChange = (key: string, raw: string) => {
    if (!selectedSchema) return;
    const t = selectedSchema.properties?.[key]?.type || 'string';
    let v: any = raw;
    if (t === 'number') v = raw === '' ? '' : Number(raw);
    if (t === 'boolean') v = raw === 'true';
    setClaims(prev => ({ ...prev, [key]: v }));
  };

  const handleCreate = async () => {
    if (!schemaId) return alert('Select a schema');
    try {
      setCreating(true);
      const payload: Record<string, any> = {};
      // Only include non-empty fields
      Object.entries(claims).forEach(([k, v]) => {
        if (v !== '' && v !== undefined) payload[k] = v;
      });
      const out = await createOffer(schemaId, payload, userPin || undefined);
      setResult(out);
    } catch (e: any) {
      alert(`Create offer failed: ${e?.message || e}`);
    } finally {
      setCreating(false);
    }
  };

  const deepLink = result
    ? `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(result.credential_offer_uri)}`
    : '';

  return (
    <div style={{ maxWidth: 800 }}>
      <h1>Create Offer (OID4VCI)</h1>

      <label style={{ display: 'block', marginTop: 12 }}>Schema</label>
      <select value={schemaId} onChange={(e) => setSchemaId(e.target.value)}>
        <option value="">Select Schema</option>
        {schemas.map(s => (
          <option key={s.$id} value={s.$id}>{s.name}</option>
        ))}
      </select>

      {selectedSchema && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <h3>Claims</h3>
          {Object.entries(selectedSchema.properties || {}).map(([key, prop]) => {
            const t = prop.type;
            const required = selectedSchema.required?.includes(key);
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <label>{key}{required ? ' *' : ''}</label>
                {t === 'boolean' ? (
                  <select
                    value={String(claims[key])}
                    onChange={(e) => handleClaimChange(key, e.target.value)}
                  >
                    <option value="">--</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={t === 'number' ? 'number' : 'text'}
                    value={claims[key]}
                    onChange={(e) => handleClaimChange(key, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <label>Optional PIN (wallet will prompt if set)</label>
        <input value={userPin} onChange={(e) => setUserPin(e.target.value)} placeholder="e.g. 1234" />
      </div>

      <button disabled={creating || !schemaId} onClick={handleCreate} style={{ marginTop: 16 }}>
        {creating ? 'Creating...' : 'Create Offer'}
      </button>

      {result && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <div><b>Offer ID:</b> {result.id}</div>
          <div style={{ marginTop: 6 }}>
            <b>credential_offer_uri:</b>
            <div style={{ wordBreak: 'break-all' }}>{result.credential_offer_uri}</div>
            <button onClick={() => navigator.clipboard.writeText(result.credential_offer_uri)} style={{ marginTop: 6 }}>
              Copy credential_offer_uri
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <b>Deep link:</b>
            <div style={{ wordBreak: 'break-all' }}>{deepLink}</div>
            <button onClick={() => navigator.clipboard.writeText(deepLink)} style={{ marginTop: 6 }}>
              Copy openid-credential-offer link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
