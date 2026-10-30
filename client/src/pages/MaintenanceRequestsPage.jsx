import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import useAuth from '../auth/useAuth.js';

const EMPTY_FORM = { category: 'Plumbing', description: '', priority: 'Medium' };
const CATEGORIES = ['Plumbing', 'Electrical', 'Cleaning', 'Security', 'Appliance', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];

// FR-05: a status change must reach the resident's view within 3 seconds
const REFRESH_MS = 3000;

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
}

function statusClass(status) {
  if (status === 'Resolved') return 'badge badge-green';
  if (status === 'In Progress') return 'badge badge-blue';
  return 'badge badge-grey';
}

export default function MaintenanceRequestsPage() {
  const { user } = useAuth();
  const isResident = user?.role === 'resident';
  const canUpdateStatus = user?.role === 'maintenance' || user?.role === 'admin';

  const [form, setForm] = useState(EMPTY_FORM);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRequests = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get('/maintenance-requests');
      setRequests(response.data.requests || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests(true);
    const timer = window.setInterval(() => loadRequests(false), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadRequests]);

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
      await loadRequests(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(request, status) {
    if (status === request.status) return;
    setError('');
    setMessage('');
    setUpdatingId(request._id);
    try {
      const response = await api.patch(`/maintenance-requests/${request._id}`, { status });
      setMessage(response.data.message);
      await loadRequests(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section>
      <h1>Maintenance Requests</h1>
      <p className="muted">
        {isResident
          ? 'Report a maintenance issue and track its status.'
          : 'Review maintenance requests and update their status.'}
      </p>

      {isResident && (
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
      )}

      {message && <p className="alert alert-success" role="status">{message}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <h2>{isResident ? 'Request history' : 'All requests'}</h2>
      {loading ? <p>Loading maintenance requests...</p> : requests.length === 0 ? (
        <p className="muted">
          {isResident ? 'You have not submitted any maintenance requests yet.' : 'There are no maintenance requests yet.'}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {!isResident && <th>Resident</th>}
                <th>Category</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>{requests.map((request) => (
              <tr key={request._id}>
                {!isResident && <td>{request.resident?.name || '—'}</td>}
                <td>{request.category}</td>
                <td className="cell-wrap">{request.description}</td>
                <td>{request.priority}</td>
                <td>{formatDate(request.createdAt)}</td>
                <td>
                  {canUpdateStatus ? (
                    <select
                      aria-label={`Status of ${request.category} request`}
                      value={request.status}
                      disabled={updatingId === request._id}
                      onChange={(event) => handleStatusChange(request, event.target.value)}
                    >
                      {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  ) : (
                    <span className={statusClass(request.status)}>{request.status}</span>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
