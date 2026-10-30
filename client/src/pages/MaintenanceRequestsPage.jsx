import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';

const EMPTY_FORM = { category: 'Plumbing', description: '', priority: 'Medium' };
const CATEGORIES = ['Plumbing', 'Electrical', 'Cleaning', 'Security', 'Appliance', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
}

export default function MaintenanceRequestsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/maintenance-requests');
      setRequests(response.data.requests || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const response = await api.post('/maintenance-requests', form);
      const { message: confirmation, request } = response.data;
      setMessage(`${confirmation || 'Maintenance request submitted successfully.'} Status: ${request?.status || 'Open'}.`);
      setForm(EMPTY_FORM);
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Maintenance Requests</h1>
      <p className="muted">Report a maintenance issue and track its status.</p>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2 className="form-title">Raise a maintenance request</h2>
        <label>
          Category
          <select name="category" value={form.category} onChange={handleChange} required>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" value={form.priority} onChange={handleChange} required>
            {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <label>
          Description
          <textarea name="description" value={form.description} onChange={handleChange} required maxLength={2000} rows={4} placeholder="Describe the issue that needs fixing..." />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit request'}
          </button>
        </div>
      </form>

      {message && <p className="alert alert-success" role="status">{message}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <h2>Request history</h2>
      {loading ? <p>Loading maintenance requests...</p> : requests.length === 0 ? (
        <p className="muted">You have not submitted any maintenance requests yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Category</th><th>Description</th><th>Priority</th><th>Submitted</th><th>Status</th></tr></thead>
            <tbody>{requests.map((request) => (
              <tr key={request._id}>
                <td>{request.category}</td>
                <td>{request.description}</td>
                <td>{request.priority}</td>
                <td>{formatDate(request.createdAt)}</td>
                <td><span className={`badge ${request.status === 'Resolved' ? 'badge-green' : request.status === 'In Progress' ? 'badge-blue' : 'badge-grey'}`}>{request.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
