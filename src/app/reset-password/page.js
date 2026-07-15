"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Check if recovery session is active
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError('No active recovery session detected. Please request a new reset link from the login page.');
      }
    });
  }, []);

  const handleUpdatePassword = async e => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setBusy(true); setError(''); setNotice('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      
      // Clean up the recovery session
      await supabase.auth.signOut();
      
      setNotice('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleUpdatePassword}>
        <h1>Update Password</h1>
        <div className="tag">Set new credentials</div>
        {error && <div className="alert-error">{error}</div>}
        {notice && <div className="alert-ok">{notice}</div>}
        
        {!notice && !error.includes('No active recovery session') && (
          <>
            <Field label="New Password (min 8 characters)">
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  autoComplete="new-password"
                  style={{ paddingRight: '50px' }}
                  required
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
            
            <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
              {busy ? 'Updating…' : 'Update Password'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
