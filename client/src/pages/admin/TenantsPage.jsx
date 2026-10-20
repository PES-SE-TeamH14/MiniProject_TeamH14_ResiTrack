import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client.js';

const EMPTY_FORM = { name: '', email: '', phone: '', flat: '', leaseStart: '', leaseEnd: '' };

// Dates come back as ISO strings; <input type="date"> needs YYYY-MM-DD
const toInputDate = (value) => (value ? value.slice(0, 10) : '');
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Admin: register tenants, edit their details, record move-outs (FR-01, UC-01)
export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [vacantFlats, setVacantFlats] = useState([]);
  const [status, setStatus] = useState('current');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null); // tenant being edited
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantRes, flatRes] = await Promise.all([
        api.get('/tenants', { params: { status } }),
        api.get('/flats', { params: { available: 'true' } }),
      ]);
      setTenants(tenantRes.data.tenants);
      setVacantFlats(flatRes.data.flats);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function startEdit(tenant) {
    setEditing(tenant);
    setForm({
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      flat: tenant.flat?._id || '',
      leaseStart: toInputDate(tenant.leaseStart),
      leaseEnd: toInputDate(tenant.leaseEnd),
    });
    setError('');
    setMessage('');
  }

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editing) {
        // The flat cannot be changed here, so it is not sent
        const { name, email, phone, leaseStart, leaseEnd } = form;
        const res = await api.patch(`/tenants/${editing._id}`, { name, email, phone, leaseStart, leaseEnd });
        setMessage(`Details for ${res.data.tenant.name} updated.`);
      } else {
        const res = await api.post('/tenants', form);
        setMessage(`${res.data.tenant.name} registered in flat ${res.data.tenant.flat.flatNumber}.`);
      }
      resetForm();
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function moveOut(tenant) {
    const ok = window.confirm(
      `Record that ${tenant.name} has moved out of flat ${tenant.flat?.flatNumber}? The flat will become vacant.`,
    );
    if (!ok) return;
    setError('');
    setMessage('');
    try {
      await api.post(`/tenants/${tenant._id}/move-out`);
      setMessage(`${tenant.name} moved out. Flat ${tenant.flat?.flatNumber} is now vacant.`);
      if (editing?._id === tenant._id) resetForm();
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const noVacantFlats = !editing && !loading && vacantFlats.length === 0;

  return (
    <section>
      <h1>Tenants</h1>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2 className="form-title">{editing ? `Edit ${editing.name}` : 'Register a tenant'}</h2>
        <label>
          Full name
          <input name="name" value={form.name} onChange={handleChange} required maxLength={100} />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={handleChange} required />
        </label>
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            required
            pattern="\+?[0-9]{10,13}"
            title="10 to 13 digits, optionally starting with +"
          />
        </label>
        <label>
          Flat
          {editing ? (
            <input value={editing.flat?.flatNumber || ''} disabled />
          ) : (
            <select name="flat" value={form.flat} onChange={handleChange} required>
              <option value="">Select a vacant flat</option>
              {vacantFlats.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.flatNumber}
                  {f.block ? ` (Block ${f.block})` : ''} · ₹{f.monthlyRent.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          )}
        </label>
        <label>
          Lease start
          <input name="leaseStart" type="date" value={form.leaseStart} onChange={handleChange} required />
        </label>
        <label>
          Lease end
          <input
            name="leaseEnd"
            type="date"
            value={form.leaseEnd}
            min={form.leaseStart || undefined}
            onChange={handleChange}
            required
          />
        </label>
        {noVacantFlats && (
          <p className="form-note muted">
            No vacant flats available. <Link to="/admin/flats">Add or reactivate a flat</Link> first.
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={noVacantFlats}>
            {editing ? 'Save changes' : 'Register tenant'}
          </button>
          {editing && (
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {message && <p className="alert alert-success">{message}</p>}
      {error && <p className="alert alert-error">{error}</p>}

      <div className="toolbar">
        <label>
          Show{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="current">Current tenants</option>
            <option value="past">Past tenants</option>
            <option value="all">All tenants</option>
          </select>
        </label>
        <span className="muted">{tenants.length} tenant(s)</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : tenants.length === 0 ? (
        <p className="muted">No tenants to show.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Flat</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Lease</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t._id} className={t.isActive ? '' : 'row-inactive'}>
                  <td>{t.name}</td>
                  <td>{t.flat?.flatNumber || '—'}</td>
                  <td>{t.email}</td>
                  <td>{t.phone}</td>
                  <td>
                    {formatDate(t.leaseStart)} – {formatDate(t.leaseEnd)}
                  </td>
                  <td>
                    {t.isActive ? (
                      <span className="badge badge-green">Current</span>
                    ) : (
                      <span className="badge badge-grey">Moved out {formatDate(t.movedOutAt)}</span>
                    )}
                  </td>
                  <td className="actions">
                    {t.isActive && (
                      <>
                        <button type="button" className="btn btn-small" onClick={() => startEdit(t)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => moveOut(t)}>
                          Move out
                        </button>
                      </>
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
