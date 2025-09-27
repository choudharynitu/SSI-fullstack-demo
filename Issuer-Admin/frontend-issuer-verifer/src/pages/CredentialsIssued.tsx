
import { useEffect, useState } from 'react';
import { getIssuedByHash, listIssued } from '../api/backend';
import './CredentialsIssued.css';

type Row = {
  hash: string;
  type?: string[];
  primaryType?: string | null;
  issuer?: string | null;
  subject?: string | null;
  issuanceDate?: string | null;
};

export default function CredentialsIssued() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [take, setTake] = useState(25);
  const [skip, setSkip] = useState(0);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listIssued({ take, skip });
      setRows(data.items || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [take, skip]);

  const openRow = async (hash: string) => {
    try {
      const full = await getIssuedByHash(hash);
      setSelected(full);
    } catch (e: any) {
      alert(`Failed to fetch credential: ${e?.message || e}`);
    }
  };

  return (
    <div>
      <h1>Credentials Issued</h1>

      <div style={{ marginBottom: 12 }}>
        <label>Page size:&nbsp;</label>
        <select value={take} onChange={e => setTake(Number(e.target.value))}>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <button onClick={() => setSkip(Math.max(0, skip - take))} style={{ marginLeft: 8 }}>Prev</button>
        <button onClick={() => setSkip(skip + take)} style={{ marginLeft: 8 }}>Next</button>
        <button onClick={load} style={{ marginLeft: 8 }}>Refresh</button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      {!loading && !error && (
        <table className="issued-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Subject</th>
              <th>Issuer</th>
              <th>Issued At</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} onClick={() => r.hash && openRow(r.hash)} style={{ cursor: 'pointer' }}>
                <td>{r.primaryType || (r.type && r.type.join(',')) || '-'}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subject || '-'}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.issuer || '-'}</td>
                <td>{r.issuanceDate || '-'}</td>
                <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="drawer">
          <div className="drawer-content">
            <h3>Verifiable Credential</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(selected, null, 2)}
            </pre>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}









