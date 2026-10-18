"use client";
import {useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';

type Mode = 'login' | 'setup' | 'confirm' | 'change-password';
export function OwnerPasswordForm({mode = 'login'}: {mode?: Mode}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const setup = mode === 'setup', change = mode === 'change-password';
  useEffect(() => {
    if (mode !== 'setup') return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get('token');
    if (code && /^[A-Za-z0-9_-]{43}$/.test(code)) {
      setToken(code);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [mode]);
  return <form className="staff-form" onSubmit={async event => {
    event.preventDefault();
    if (submitting.current) return;
    const chosen = change ? nextPassword : password;
    if ((setup || change) && chosen !== repeat) { setMessage('The new passwords do not match.'); return; }
    submitting.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login' : '/api/owner-auth', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: mode, email, password, ...(setup ? {token} : {}), ...(change ? {newPassword: nextPassword} : {})})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sign-in could not be completed.');
      setPassword(''); setNextPassword(''); setRepeat(''); setToken('');
      setMessage(data.message || 'Signed in.');
      if (mode !== 'confirm') router.replace('/dashboard');
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }}>
    {(mode === 'login' || setup) && <label>Email<input className="input" name="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required/></label>}
    {setup && <label>Password setup code<input className="input" name="token" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} required/></label>}
    <label>{setup ? 'New password' : mode === 'login' ? 'Password' : 'Current password'}<input className="input" name="password" type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={setup ? 15 : undefined} maxLength={128} required/></label>
    {change && <label>New password<input className="input" name="newPassword" type="password" autoComplete="new-password" value={nextPassword} onChange={e => setNextPassword(e.target.value)} minLength={15} maxLength={128} required/></label>}
    {(setup || change) && <><label>Confirm new password<input className="input" name="repeat" type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} minLength={15} maxLength={128} required/></label><p className="muted small">Use 15–128 characters. A unique passphrase works well.</p></>}
    {message && <p role="status">{message}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? 'Please wait…' : setup ? 'Save password & sign in' : change ? 'Change password' : mode === 'confirm' ? 'Confirm password' : 'Sign in'}</button>
  </form>;
}
