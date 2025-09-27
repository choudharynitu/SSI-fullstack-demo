import axios from "axios";

//const API_BASE = "http://localhost:8000/api";
const API_BASE =
  import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';

export const createDID = async (provider: string) => {
  const response = await axios.post(`${API_BASE}/dids/create`, { provider });
  return response.data;
};

export const resolveDID = async (did: string) => {
  return fetch(`http://localhost:8000/api/dids/resolve/${encodeURIComponent(did)}`)
    .then((res) => res.json())
    .catch((err) => {
      console.error("Error resolving DID:", err);
      return { success: false, error: "Failed to resolve DID." };
    });
};


export const getDIDs = async (): Promise<{ dids: { did: string; provider: string }[] }> => {
  const response = await fetch("http://localhost:8000/api/dids/list");
  return response.json();
};

export const listSchemas = async () => {
  const response = await axios.get(`${API_BASE}/schemas/list`);
  return response.data.schemas;
};

export const createSchema = async (schemaData: any) => {
    const response = await fetch("http://localhost:8000/api/schemas/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schemaData),
    });
    return response.json();
  };

 export const getSchemas = async () => {
  const res = await fetch(`${API_BASE}/schemas/list`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${await res.text()}`);

  const body = await res.json();
  const raw = Array.isArray(body) ? body : (body.schemas ?? body.items ?? body.data ?? []);

  // Normalize minimal fields the Offer page needs
  return raw.map((s: any) => ({
    $id: s.$id ?? s.id ?? s.schemaId,           // prefer $id if present
    name: s.name ?? s.title ?? (s.$id ?? s.id), // decent label fallback
    properties: s.properties ?? {},
    required: s.required ?? [],
  }));
};
  
 /* export const getSchemas = async () => {
    const response = await fetch("http://localhost:8000/api/schemas/list");
    return response.json();
  }; */
export const issueCredential = async (credentialData: any) => {

  console.log("Sending Credential data:", credentialData);

  const response = await fetch("http://localhost:8000/api/credentials/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentialData),
  });

  const data = await response.json();
  console.log("Credential Issuance Response:", data);
  return data;
};


export const verifyCredential = async (data: any) => {
  //const response = await axios.post(`${API_BASE}/credentials/verify`, data);
  const response = await fetch("http://localhost:8000/api/credentials/verify", data)
  return response.json();
};

export const getIssuedCredentials = async () => {
  return fetch("http://localhost:8000/api/credentials/list")
    .then((res) => res.json())
    .catch((err) => {
      console.error("Error fetching issued credentials:", err);
      return { success: false, error: "Failed to fetch issued credentials." };
    });
};

export const createOffer = async (
  schemaId: string,
  claims: Record<string, any>,
  userPin?: string | null
) => {
  const res = await fetch(`${API_BASE}/offers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ schemaId, claims, userPin: userPin || undefined }),
  });
  if (!res.ok) throw new Error(await res.text());
  // => { id, credential_offer_uri }
  return res.json();
};

export const listIssued = async (params?: {
  subjectDid?: string;
  issuer?: string;
  type?: string;
  take?: number;
  skip?: number;
}) => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const res = await fetch(`${API_BASE}/issued?${q.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  // => { take, skip, count, items: [{ hash, type[], primaryType, issuer, subject, issuanceDate, ...}] }
  return res.json();
};

export const getIssuedByHash = async (hash: string) => {
  const res = await fetch(`${API_BASE}/issued/${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // full VC
};

