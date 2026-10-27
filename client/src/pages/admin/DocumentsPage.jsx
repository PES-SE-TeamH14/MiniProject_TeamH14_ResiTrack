import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getErrorMessage } from '../../api/client.js';

const DOC_TYPES = ['Lease agreement', 'ID proof', 'Other'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // FR-11: up to 5 MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg'];
const EMPTY_FORM = { tenant: '', docType: 'Lease agreement' };

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Quick check in the browser; the server checks the real file contents again (SEC-06)
function checkFile(file) {
  if (!file) return 'Choose a PDF or JPEG file.';
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Only PDF and JPEG files are allowed.';
  if (file.size > MAX_SIZE_BYTES) return 'Files can be at most 5 MB.';
  return '';
}

// Admin: upload and download tenant lease agreements and ID proofs (FR-11, UC-11)
export default function DocumentsPage() {
  const [tenants, setTenants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [filterTenant, setFilterTenant] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInput = useRef(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterTenant ? { tenant: filterTenant } : {};
      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterTenant]);

  useEffect(() => {
    api
      .get('/tenants', { params: { status: 'all' } })
      .then((res) => setTenants(res.data.tenants))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleFileChange(e) {
    const chosen = e.target.files[0] || null;
    setFile(chosen);
    setError(chosen ? checkFile(chosen) : '');
    setMessage('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    const problem = checkFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setUploading(true);

    const data = new FormData();
    data.append('tenant', form.tenant);
    data.append('docType', form.docType);
    data.append('file', file);

    try {
      // multipart/form-data: the browser adds the boundary itself
      const res = await api.post('/documents', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage(`${res.data.document.originalName} uploaded.`);
      setForm(EMPTY_FORM);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      loadDocuments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  // Downloads go through the API client so the login token is sent
  async function download(doc) {
    setError('');
    try {
      const res = await api.get(`/documents/${doc._id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section>
      <h1>Tenant documents</h1>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2 className="form-title">Upload a document</h2>
        <label>
          Tenant
          <select name="tenant" value={form.tenant} onChange={handleChange} required>
            <option value="">Select a tenant</option>
            {tenants.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
                {t.flat?.flatNumber ? ` (${t.flat.flatNumber})` : ''}
                {t.isActive ? '' : ' – moved out'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Document type
          <select name="docType" value={form.docType} onChange={handleChange}>
            {DOC_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          File (PDF or JPEG, max 5 MB)
          <input
            ref={fileInput}
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
            onChange={handleFileChange}
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>

      {message && <p className="alert alert-success">{message}</p>}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="toolbar">
        <label>
          Show{' '}
          <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)}>
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">{documents.length} document(s)</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : documents.length === 0 ? (
        <p className="muted">No documents uploaded yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Type</th>
                <th>File</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc._id}>
                  <td>{doc.tenant?.name || '—'}</td>
                  <td>
                    <span className="badge badge-outline">{doc.docType}</span>
                  </td>
                  <td>{doc.originalName}</td>
                  <td>{formatSize(doc.size)}</td>
                  <td>{new Date(doc.createdAt).toLocaleString('en-IN')}</td>
                  <td className="actions">
                    <button type="button" className="btn btn-small" onClick={() => download(doc)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
