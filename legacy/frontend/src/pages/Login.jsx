import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(username, password); nav('/'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Cheque Manager</h1>
        <div className="tag">Admin sign in</div>
        {error && <div className="alert-error">{error}</div>}
        <Field label="Username">
          <input value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
