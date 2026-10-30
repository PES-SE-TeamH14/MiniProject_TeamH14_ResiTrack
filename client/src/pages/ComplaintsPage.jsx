
import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'Plumbing',
  flatNumber: '',
};

const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Security',
  'Maintenance',
  'Other',
];

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-IN');
}

function statusClass(status) {
  if (status === 'Resolved') return 'badge badge-green';
  if (status === 'In Progress') return 'badge badge-blue';
  return 'badge badge-grey';
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await api.get('/complaints');
      setComplaints(res.data.complaints || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  function handleChange(e) {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const res = await api.post('/complaints', form);
      setMessage(
        `Complaint "${res.data.complaint.title}" filed successfully.`,
      );
      setForm(EMPTY_FORM);
      await loadComplaints();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Complaints</h1>
      <p className="muted">
        Report an issue and track its resolution.
      </p>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2 className="form-title">File a complaint</h2>

        <label>
          Complaint title
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            maxLength={120}
            placeholder="e.g. Water leakage"
          />
        </label>

        <label>
          Flat number
          <input
            name="flatNumber"
            value={form.flatNumber}
            onChange={handleChange}
            required
            maxLength={20}
            placeholder="e.g. A-101"
          />
        </label>

        <label>
          Category
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            required
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            maxLength={2000}
            rows={4}
            placeholder="Describe the issue..."
          />
        </label>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit complaint'}
          </button>
        </div>
      </form>

      {message && <p className="alert alert-success">{message}</p>}
      {error && <p className="alert alert-error">{error}</p>}

      <h2>Complaint history</h2>

      {loading ? (
        <p>Loading complaints...</p>
      ) : complaints.length === 0 ? (
        <p className="muted">No complaints have been filed yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Complaint</th>
                <th>Flat</th>
                <th>Category</th>
                <th>Filed on</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => (
                <tr key={complaint._id}>
                  <td>
                    <strong>{complaint.title}</strong>
                    <p className="muted">{complaint.description}</p>
                  </td>
                  <td>{complaint.flatNumber}</td>
                  <td>{complaint.category}</td>
                  <td>{formatDate(complaint.createdAt)}</td>
                  <td>
                    <span className={statusClass(complaint.status)}>
                      {complaint.status}
                    </span>
                  </td>
                  <td className="actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() =>
                        setExpandedId((current) =>
                          current === complaint._id
                            ? null
                            : complaint._id,
                        )
                      }
                      aria-expanded={expandedId === complaint._id}
                    >
                      {expandedId === complaint._id
                        ? 'Hide history'
                        : 'View history'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {complaints
            .filter((complaint) => complaint._id === expandedId)
            .map((complaint) => (
              <div className="card" key={complaint._id}>
                <h3>Status history: {complaint.title}</h3>
                <ol>
                  {(complaint.statusHistory || []).map((entry, index) => (
                    <li key={`${entry.status}-${entry.changedAt}-${index}`}>
                      <strong>{entry.status}</strong>
                      {' — '}
                      {formatDate(entry.changedAt)}
                      {entry.note && <p>{entry.note}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
