import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import { downloadReceipt } from '../api/receipts.js';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

// Resident: see their own rent payments and download receipts (FR-15, UC-15)
export default function MyReceiptsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    api
      .get('/payments/mine')
      .then((res) => setPayments(res.data.payments))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(payment) {
    setBusyId(payment._id);
    setError('');
    try {
      await downloadReceipt(payment);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId('');
    }
  }

  return (
    <section>
      <h1>My rent receipts</h1>
      {error && <p className="alert alert-error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : payments.length === 0 ? (
        <p className="muted">No rent payments have been recorded for you yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rent for</th>
                <th>Flat</th>
                <th>Amount</th>
                <th>Paid on</th>
                <th>Method</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>{monthLabel(p.month)}</td>
                  <td>{p.flat?.flatNumber || '—'}</td>
                  <td>{rupees(p.amount)}</td>
                  <td>{formatDate(p.paidOn)}</td>
                  <td>{p.method}</td>
                  <td className="actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => handleDownload(p)}
                      disabled={busyId === p._id}
                    >
                      {busyId === p._id ? 'Preparing…' : 'Download PDF'}
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
