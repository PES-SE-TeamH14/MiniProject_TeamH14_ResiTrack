import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../api/client.js';

const METHODS = ['UPI', 'Cash', 'Bank transfer', 'Cheque', 'Other'];

// Local dates as YYYY-MM / YYYY-MM-DD (toISOString would give the UTC date)
function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const thisMonth = () => localDate().slice(0, 7);
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

// Admin: record and track monthly rent payments (FR-06, UC-06)
export default function RentPage() {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [recording, setRecording] = useState(null); // the row being paid
  const [form, setForm] = useState({ amount: '', paidOn: '', method: 'UPI', reference: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStatus = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const res = await api.get('/payments/status', { params: { month } });
      setRows(res.data.rows);
      setSummary(res.data.summary);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  function startRecording(row) {
    setRecording(row);
    setForm({ amount: String(row.rent), paidOn: localDate(), method: 'UPI', reference: '' });
    setError('');
    setMessage('');
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/payments', {
        tenant: recording.tenant._id,
        month,
        amount: Number(form.amount),
        paidOn: form.paidOn,
        method: form.method,
        reference: form.reference,
      });
      setMessage(`Rent for ${monthLabel(month)} recorded for ${recording.tenant.name}.`);
      setRecording(null);
      loadStatus();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section>
      <h1>Rent payments</h1>

      <div className="toolbar">
        <label>
          Month{' '}
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setRecording(null);
              setMessage('');
            }}
          />
        </label>
      </div>

      {summary && (
        <div className="stats">
          <div className="stat">
            <span className="stat-label">Expected</span>
            <span className="stat-value">{rupees(summary.expected)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Collected</span>
            <span className="stat-value">{rupees(summary.collected)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Paid</span>
            <span className="stat-value">
              {summary.paid} / {summary.tenants}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Unpaid</span>
            <span className="stat-value">{summary.unpaid}</span>
          </div>
        </div>
      )}

      {recording && (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h2 className="form-title">
            Record rent for {recording.tenant.name} · Flat {recording.flat?.flatNumber} · {monthLabel(month)}
          </h2>
          <label>
            Amount (₹)
            <input name="amount" type="number" min="1" value={form.amount} onChange={handleChange} required />
          </label>
          <label>
            Paid on
            <input
              name="paidOn"
              type="date"
              max={localDate()}
              value={form.paidOn}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Method
            <select name="method" value={form.method} onChange={handleChange}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reference (optional)
            <input name="reference" value={form.reference} onChange={handleChange} maxLength={100} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save payment
            </button>
            <button type="button" className="btn" onClick={() => setRecording(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {message && <p className="alert alert-success">{message}</p>}
      {error && <p className="alert alert-error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No tenants have a lease covering {monthLabel(month)}.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Flat</th>
                <th>Rent</th>
                <th>Status</th>
                <th>Paid on</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tenant._id}>
                  <td>{row.tenant.name}</td>
                  <td>{row.flat?.flatNumber || '—'}</td>
                  <td>{rupees(row.rent)}</td>
                  <td>
                    <span className={`badge ${row.status === 'Paid' ? 'badge-green' : 'badge-red'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.payment ? formatDate(row.payment.paidOn) : '—'}</td>
                  <td>{row.payment ? rupees(row.payment.amount) : '—'}</td>
                  <td>{row.payment ? row.payment.method : '—'}</td>
                  <td className="actions">
                    {row.status === 'Unpaid' && (
                      <button type="button" className="btn btn-small" onClick={() => startRecording(row)}>
                        Record payment
                      </button>
                    )}
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
