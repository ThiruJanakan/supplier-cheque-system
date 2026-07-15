"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Field } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try { 
      await login(username, password); 
      router.push('/'); 
    }
    catch (err) { 
      setError(err.message); 
    }
    finally { 
      setBusy(false); 
    }
  };

  const handleForgotPassword = async e => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail('Thirujanakan@gmail.com', {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setNotice('Verification link sent successfully to Thirujanakan@gmail.com. Please check your inbox.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      {mode === 'login' ? (
        <form className="login-card" onSubmit={submit}>
          <h1>Cheque Manager</h1>
          <div className="tag">Admin sign in</div>
          {error && <div className="alert-error">{error}</div>}
          {notice && <div className="alert-ok">{notice}</div>}
          
          <Field label="Username">
            <input 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              autoFocus 
              autoComplete="username" 
            />
          </Field>
          
          <Field label="Password">
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                autoComplete="current-password"
                style={{ paddingRight: '50px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--muted)', 
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  userSelect: 'none'
                }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </Field>
          
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '14px' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <a 
              href="#" 
              className="muted" 
              style={{ fontSize: '12.5px' }} 
              onClick={e => { e.preventDefault(); setMode('forgot'); setError(''); setNotice(''); }}
            >
              Forgot password?
            </a>
          </div>
        </form>
      ) : (
        <form className="login-card" onSubmit={handleForgotPassword}>
          <h1>Reset Password</h1>
          <div className="tag">Password Recovery</div>
          {error && <div className="alert-error">{error}</div>}
          {notice && <div className="alert-ok">{notice}</div>}
          
          <p className="muted" style={{ fontSize: '13px', lineHeight: '1.4', marginBottom: '20px' }}>
            A password reset request will be sent to the administrator's email: <strong>Thirujanakan@gmail.com</strong>
          </p>
          
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
            {busy ? 'Sending link…' : 'Send Reset Link'}
          </button>
          
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <a 
              href="#" 
              className="muted" 
              style={{ fontSize: '12.5px' }} 
              onClick={e => { e.preventDefault(); setMode('login'); setError(''); setNotice(''); }}
            >
              Back to Sign In
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
