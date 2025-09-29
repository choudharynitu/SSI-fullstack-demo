import { useState, useEffect } from "react";
import {
  createPresentationRequest,
  createPresentationDefinition,
  getVerificationSession,
  listPresentationRequests,
  listVerificationSessions,
} from "../api/backend";

interface PresentationDefinition {
  credential_types: string[];
  required_fields: string[];
  trusted_issuers: string[];
  purpose: string;
}

interface VerificationResult {
  valid: boolean;
  holder?: string;
  credentials: any[];
  errors: string[];
}

const OID4VPVerifier = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'monitor' | 'history'>('create');

  // Create request state
  const [presentationDef, setPresentationDef] = useState<PresentationDefinition>({
    credential_types: ['VerifiableCredential'],
    required_fields: [],
    trusted_issuers: [],
    purpose: 'Please provide your credentials for verification'
  });
  const [requestResult, setRequestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Monitoring state
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [verificationSessions, setVerificationSessions] = useState<any[]>([]);
  const [pollingSessionId, setPollingSessionId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  // Auto-refresh monitoring data
  useEffect(() => {
    if (activeTab === 'monitor' || activeTab === 'history') {
      loadMonitoringData();
      const interval = setInterval(loadMonitoringData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Poll for verification results
  useEffect(() => {
    if (pollingSessionId) {
      const pollResult = async () => {
        try {
          const session = await getVerificationSession(pollingSessionId);
          if (session.success) {
            setVerificationResult(session.session.verification_result);
            // Stop polling once we have a result
            if (session.session.verification_result.valid !== undefined) {
              setPollingSessionId(null);
            }
          }
        } catch (err) {
          console.error('Error polling verification result:', err);
        }
      };

      const pollInterval = setInterval(pollResult, 2000); // Poll every 2 seconds
      return () => clearInterval(pollInterval);
    }
  }, [pollingSessionId]);

  const loadMonitoringData = async () => {
    try {
      const [requestsResponse, sessionsResponse] = await Promise.all([
        listPresentationRequests(),
        listVerificationSessions()
      ]);

      if (requestsResponse.success) {
        setActiveRequests(requestsResponse.requests);
      }
      if (sessionsResponse.success) {
        setVerificationSessions(sessionsResponse.sessions);
      }
    } catch (err) {
      console.error('Error loading monitoring data:', err);
    }
  };

  const handleCreateRequest = async () => {
    setLoading(true);
    setError("");
    setRequestResult(null);
    setVerificationResult(null);

    try {
      // First create the presentation definition
      const defResponse = await createPresentationDefinition(presentationDef);

      if (!defResponse.success) {
        throw new Error(defResponse.error || 'Failed to create presentation definition');
      }

      // Then create the presentation request
      const requestResponse = await createPresentationRequest({
        presentation_definition: defResponse.presentation_definition,
        client_id: 'oid4vp-verifier-demo',
      });

      if (!requestResponse.success) {
        throw new Error(requestResponse.error || 'Failed to create presentation request');
      }

      setRequestResult(requestResponse);
      // Start monitoring for results if we have a session mechanism
      // Note: In a real implementation, you'd get the session ID from the response

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof PresentationDefinition, value: any) => {
    setPresentationDef(prev => ({ ...prev, [field]: value }));
  };

  const addField = (field: 'credential_types' | 'required_fields' | 'trusted_issuers') => {
    const value = (document.getElementById(`new-${field}`) as HTMLInputElement)?.value?.trim();
    if (value && !presentationDef[field].includes(value)) {
      handleFieldChange(field, [...presentationDef[field], value]);
      (document.getElementById(`new-${field}`) as HTMLInputElement).value = '';
    }
  };

  const removeField = (field: 'credential_types' | 'required_fields' | 'trusted_issuers', index: number) => {
    const newArray = [...presentationDef[field]];
    newArray.splice(index, 1);
    handleFieldChange(field, newArray);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const renderCreateTab = () => (
    <div className="create-tab">
      <h3>Create Presentation Request</h3>

      <div className="form-group">
        <label>Purpose:</label>
        <input
          type="text"
          value={presentationDef.purpose}
          onChange={(e) => handleFieldChange('purpose', e.target.value)}
          placeholder="Why are you requesting this presentation?"
        />
      </div>

      <div className="form-group">
        <label>Credential Types:</label>
        <div className="field-list">
          {presentationDef.credential_types.map((type, index) => (
            <span key={index} className="field-tag">
              {type}
              <button onClick={() => removeField('credential_types', index)}>×</button>
            </span>
          ))}
        </div>
        <div className="add-field">
          <input id="new-credential_types" placeholder="Add credential type" />
          <button onClick={() => addField('credential_types')}>Add</button>
        </div>
      </div>

      <div className="form-group">
        <label>Required Fields:</label>
        <div className="field-list">
          {presentationDef.required_fields.map((field, index) => (
            <span key={index} className="field-tag">
              {field}
              <button onClick={() => removeField('required_fields', index)}>×</button>
            </span>
          ))}
        </div>
        <div className="add-field">
          <input id="new-required_fields" placeholder="Add required field (e.g., name, email)" />
          <button onClick={() => addField('required_fields')}>Add</button>
        </div>
      </div>

      <div className="form-group">
        <label>Trusted Issuers (optional):</label>
        <div className="field-list">
          {presentationDef.trusted_issuers.map((issuer, index) => (
            <span key={index} className="field-tag">
              {issuer}
              <button onClick={() => removeField('trusted_issuers', index)}>×</button>
            </span>
          ))}
        </div>
        <div className="add-field">
          <input id="new-trusted_issuers" placeholder="Add trusted issuer DID" />
          <button onClick={() => addField('trusted_issuers')}>Add</button>
        </div>
      </div>

      <button onClick={handleCreateRequest} disabled={loading} className="create-button">
        {loading ? 'Creating Request...' : 'Create Presentation Request'}
      </button>

      {error && <div className="error">Error: {error}</div>}

      {requestResult && (
        <div className="request-result">
          <h4>✅ Presentation Request Created</h4>
          <div className="result-item">
            <label>Request ID:</label>
            <code>{requestResult.request_id}</code>
          </div>
          <div className="result-item">
            <label>Request URI:</label>
            <div className="uri-container">
              <code className="uri">{requestResult.request_uri}</code>
              <button onClick={() => copyToClipboard(requestResult.request_uri)}>Copy</button>
            </div>
          </div>
          <div className="result-item">
            <label>Direct URL:</label>
            <div className="uri-container">
              <code className="uri">{requestResult.direct_request_url}</code>
              <button onClick={() => copyToClipboard(requestResult.direct_request_url)}>Copy</button>
            </div>
          </div>
          <div className="qr-placeholder">
            📱 QR Code would be generated here for mobile wallet scanning
          </div>
        </div>
      )}
    </div>
  );

  const renderMonitorTab = () => (
    <div className="monitor-tab">
      <h3>Active Presentation Requests</h3>
      {activeRequests.length === 0 ? (
        <p>No active requests</p>
      ) : (
        <div className="requests-list">
          {activeRequests.map(request => (
            <div key={request.id} className="request-item">
              <div><strong>ID:</strong> {request.id}</div>
              <div><strong>Client:</strong> {request.client_id}</div>
              <div><strong>Created:</strong> {new Date(request.created_at).toLocaleString()}</div>
              <div><strong>Expires:</strong> {new Date(request.expires_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <h3>Recent Verification Results</h3>
      {verificationSessions.length === 0 ? (
        <p>No verification sessions</p>
      ) : (
        <div className="sessions-list">
          {verificationSessions.map(session => (
            <div key={session.session_id} className="session-item">
              <div><strong>Session:</strong> {session.session_id}</div>
              <div><strong>Request:</strong> {session.request_id}</div>
              <div><strong>Valid:</strong> {session.verification_result.valid ? '✅' : '❌'}</div>
              <div><strong>Credentials:</strong> {session.verification_result.credentials_count}</div>
              <div><strong>Time:</strong> {new Date(session.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {verificationResult && (
        <div className="verification-result">
          <h4>Latest Verification Result</h4>
          <div><strong>Valid:</strong> {verificationResult.valid ? '✅' : '❌'}</div>
          {verificationResult.holder && <div><strong>Holder:</strong> {verificationResult.holder}</div>}
          <div><strong>Credentials Verified:</strong> {verificationResult.credentials.length}</div>
          {verificationResult.errors.length > 0 && (
            <div><strong>Errors:</strong> {verificationResult.errors.join(', ')}</div>
          )}
          <details>
            <summary>Full Result</summary>
            <pre>{JSON.stringify(verificationResult, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="history-tab">
      <h3>Verification History</h3>
      <div className="sessions-list">
        {verificationSessions.map(session => (
          <div key={session.session_id} className="session-item detailed">
            <div className="session-header">
              <span><strong>Session:</strong> {session.session_id}</span>
              <span className={`status ${session.verification_result.valid ? 'valid' : 'invalid'}`}>
                {session.verification_result.valid ? '✅ VALID' : '❌ INVALID'}
              </span>
            </div>
            <div><strong>Request ID:</strong> {session.request_id}</div>
            <div><strong>Credentials:</strong> {session.verification_result.credentials_count}</div>
            <div><strong>Timestamp:</strong> {new Date(session.timestamp).toLocaleString()}</div>
            <div><strong>Expires:</strong> {new Date(session.expires_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="oid4vp-verifier">
      <h2>OID4VP Verifier</h2>

      <div className="tabs">
        <button
          className={activeTab === 'create' ? 'active' : ''}
          onClick={() => setActiveTab('create')}
        >
          Create Request
        </button>
        <button
          className={activeTab === 'monitor' ? 'active' : ''}
          onClick={() => setActiveTab('monitor')}
        >
          Monitor
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'create' && renderCreateTab()}
        {activeTab === 'monitor' && renderMonitorTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>

      <style jsx>{`
        .oid4vp-verifier {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .tabs {
          display: flex;
          border-bottom: 2px solid #ddd;
          margin-bottom: 20px;
        }

        .tabs button {
          padding: 10px 20px;
          border: none;
          background: none;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }

        .tabs button.active {
          border-bottom: 2px solid #007bff;
          color: #007bff;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }

        .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .field-list {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 10px;
        }

        .field-tag {
          background: #e9ecef;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
        }

        .field-tag button {
          margin-left: 5px;
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
        }

        .add-field {
          display: flex;
          gap: 10px;
        }

        .add-field input {
          flex: 1;
        }

        .add-field button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .create-button {
          padding: 12px 24px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }

        .create-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .error {
          color: #dc3545;
          margin: 10px 0;
          padding: 10px;
          background: #f8d7da;
          border-radius: 4px;
        }

        .request-result {
          margin-top: 20px;
          padding: 20px;
          background: #d4edda;
          border-radius: 4px;
        }

        .result-item {
          margin-bottom: 15px;
        }

        .result-item label {
          display: block;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .uri-container {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .uri {
          flex: 1;
          background: #f8f9fa;
          padding: 8px;
          border-radius: 4px;
          word-break: break-all;
          font-size: 12px;
        }

        .uri-container button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .qr-placeholder {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border: 2px dashed #dee2e6;
          border-radius: 4px;
          margin-top: 15px;
        }

        .requests-list, .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .request-item, .session-item {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
          border-left: 4px solid #007bff;
        }

        .session-item.detailed {
          border-left: 4px solid #28a745;
        }

        .session-header {
          display: flex;
          justify-content: between;
          align-items: center;
          margin-bottom: 10px;
        }

        .status.valid {
          color: #28a745;
        }

        .status.invalid {
          color: #dc3545;
        }

        .verification-result {
          margin-top: 20px;
          padding: 20px;
          background: #fff3cd;
          border-radius: 4px;
        }

        details {
          margin-top: 10px;
        }

        pre {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default OID4VPVerifier;