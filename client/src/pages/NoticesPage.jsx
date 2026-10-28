import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import useAuth from '../auth/useAuth.js';

const EMPTY_FORM = { title: '', message: '' };

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently published' : date.toLocaleString('en-IN');
}

export default function NoticesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadNotices = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get('/notices');
      setNotices(response.data.notices || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotices(true);
    // Poll every five seconds so newly published notices appear promptly for residents.
    const timer = window.setInterval(() => loadNotices(false), 5000);
    return () => window.clearInterval(timer);
  }, [loadNotices]);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/notices', form);
      setMessage(`Notice “${response.data.notice.title}” published successfully.`);
      setForm(EMPTY_FORM);
      await loadNotices(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Community Notices</h1>
      <p className="muted">Important updates and announcements for your community.</p>

      {isAdmin && (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h2 className="form-title">Publish a notice</h2>
          <label>
            Notice title
            <input name="title" value={form.title} onChange={handleChange} required maxLength={120} placeholder="e.g. Water supply maintenance" />
          </label>
          <label className="notice-message-field">
            Message
            <textarea name="message" value={form.message} onChange={handleChange} required maxLength={5000} rows={4} placeholder="Enter the announcement for residents..." />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Publishing…' : 'Publish notice'}
            </button>
          </div>
        </form>
      )}

      {message && <p className="alert alert-success">{message}</p>}
      {error && <p className="alert alert-error">{error}</p>}
      <h2>Latest notices</h2>
      {loading ? <p>Loading notices…</p> : notices.length === 0 ? (
        <p className="muted">There are no active notices right now.</p>
      ) : (
        <div>
          {notices.map((notice) => (
            <article className="card" key={notice._id}>
              <h3>{notice.title}</h3>
              <p>{notice.message}</p>
              <p className="muted">Published {formatDate(notice.publishedAt || notice.createdAt)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
