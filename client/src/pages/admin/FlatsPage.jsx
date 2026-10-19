import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../api/client.js';

const FLAT_TYPES = ['1RK', '1BHK', '2BHK', '3BHK', '4BHK', 'Other'];
const EMPTY_FORM = { flatNumber: '', block: '', floor: '', type: '2BHK', monthlyRent: '' };

// Admin: manage flat inventory — add, edit, deactivate (FR-12, UC-12)
export default function FlatsPage() {
  const [flats, setFlats] = useState([]);
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadFlats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/flats', { params: { status } });
      setFlats(res.data.flats);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadFlats();
  }, [loadFlats]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function startEdit(flat) {
    setEditingId(flat._id);
    setForm({
      flatNumber: flat.flatNumber,
      block: flat.block || '',
      floor: String(flat.floor ?? ''),
      type: flat.type,
      monthlyRent: String(flat.monthlyRent),
    });
    setError('');
    setMessage('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    const payload = {
      flatNumber: form.flatNumber,
      block: form.block,
      floor: form.floor === '' ? 0 : Number(form.floor),
      type: form.type,
      monthlyRent: form.monthlyRent === '' ? undefined : Number(form.monthlyRent),
    };
    try {
      if (editingId) {
        const res = await api.patch(`/flats/${editingId}`, payload);
        setMessage(`Flat ${res.data.flat.flatNumber} updated.`);
      } else {
        const res = await api.post('/flats', payload);
        setMessage(`Flat ${res.data.flat.flatNumber} added.`);
      }
      resetForm();
      loadFlats();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function toggleActive(flat) {
    setError('');
    setMessage('');
    try {
      await api.patch(`/flats/${flat._id}`, { isActive: !flat.isActive });
      setMessage(`Flat ${flat.flatNumber} ${flat.isActive ? 'deactivated' : 'reactivated'}.`);
      loadFlats();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section>
      <h1>Flat inventory</h1>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2 className="form-title">{editingId ? `Edit flat ${form.flatNumber}` : 'Add a flat'}</h2>
        <label>
          Flat number
          <input name="flatNumber" value={form.flatNumber} onChange={handleChange} required maxLength={20} />
        </label>
        <label>
          Block
          <input name="block" value={form.block} onChange={handleChange} maxLength={20} />
        </label>
        <label>
          Floor
          <input name="floor" type="number" min="0" value={form.floor} onChange={handleChange} />
        </label>
        <label>
          Type
          <select name="type" value={form.type} onChange={handleChange}>
            {FLAT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Monthly rent (₹)
          <input
            name="monthlyRent"
            type="number"
            min="0"
            value={form.monthlyRent}
            onChange={handleChange}
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {editingId ? 'Save changes' : 'Add flat'}
          </button>
          {editingId && (
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
            <option value="all">All flats</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </label>
        <span className="muted">{flats.length} flat(s)</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : flats.length === 0 ? (
        <p className="muted">No flats yet. Add the first one above.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Flat</th>
                <th>Block</th>
                <th>Floor</th>
                <th>Type</th>
                <th>Rent (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flats.map((flat) => (
                <tr key={flat._id} className={flat.isActive ? '' : 'row-inactive'}>
                  <td>{flat.flatNumber}</td>
                  <td>{flat.block || '—'}</td>
                  <td>{flat.floor}</td>
                  <td>{flat.type}</td>
                  <td>{flat.monthlyRent.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`badge ${flat.isActive ? 'badge-green' : 'badge-grey'}`}>
                      {flat.isActive ? 'Active' : 'Inactive'}
                    </span>{' '}
                    <span className={`badge ${flat.isOccupied ? 'badge-blue' : 'badge-outline'}`}>
                      {flat.isOccupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn-small" onClick={() => startEdit(flat)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-small" onClick={() => toggleActive(flat)}>
                      {flat.isActive ? 'Deactivate' : 'Reactivate'}
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
