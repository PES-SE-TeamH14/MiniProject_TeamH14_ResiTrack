
import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../api/client.js';

const EMPTY_FORM = {
  visitorName: '',
  contact: '',
  purpose: '',
  flatNumber: '',
};

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString();
}

export default function VisitorsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadVisitors = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get('/visitors');
      setVisitors(response.data.visitors);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVisitors();
  }, [loadVisitors]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const response = await api.post('/visitors', form);

      setVisitors((current) => [
        response.data.visitor,
        ...current,
      ]);
      setForm(EMPTY_FORM);
      setSuccess('Visitor registered successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Visitor Management</h1>
      <p className="muted">
        Register visitors and view the visitor entry log.
      </p>

      <div className="card">
        <form className="form-grid" onSubmit={handleSubmit}>
          <h2 className="form-title">Register a visitor</h2>

          <label>
            Visitor name
            <input
              name="visitorName"
              value={form.visitorName}
              onChange={handleChange}
              maxLength={100}
              required
            />
          </label>

          <label>
            Contact number
            <input
              name="contact"
              value={form.contact}
              onChange={handleChange}
              maxLength={30}
              required
            />
          </label>

          <label>
            Purpose of visit
            <input
              name="purpose"
              value={form.purpose}
              onChange={handleChange}
              maxLength={200}
              required
            />
          </label>

          <label>
            Flat number
            <input
              name="flatNumber"
              value={form.flatNumber}
              onChange={handleChange}
              maxLength={20}
              placeholder="e.g. A-101"
              required
            />
          </label>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Register visitor'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="alert alert-success" role="status">
          {success}
        </p>
      )}

      <div className="toolbar">
        <h2>Visitor log</h2>
        <button
          className="btn"
          type="button"
          onClick={loadVisitors}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading visitors...</p>
      ) : visitors.length === 0 ? (
        <div className="card">
          No visitor entries yet.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Contact</th>
                <th>Purpose</th>
                <th>Flat</th>
                <th>Entry time</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor._id}>
                  <td>{visitor.visitorName}</td>
                  <td>{visitor.contact}</td>
                  <td>{visitor.purpose}</td>
                  <td>{visitor.flatNumber}</td>
                  <td>{formatDate(visitor.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
