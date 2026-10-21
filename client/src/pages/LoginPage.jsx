import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client.js';
import useAuth from '../auth/useAuth.js';
import { homePathFor } from '../auth/roles.js';

// Log in with email and password (FR-02, UC-02), then go to the role's dashboard
export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedIn = await login(form.email, form.password);
      navigate(homePathFor(loggedIn.role), { replace: true });
    } catch (err) {
      // e.g. "Incorrect email or password." from the API
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <section className="login-page">
      <h1>Log in</h1>
      <form className="card form-grid login-card" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={handleChange}
            required
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </label>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </form>
    </section>
  );
}
