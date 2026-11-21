'use client';
import { useEffect, useState } from 'react';
import { OwnerPasswordForm } from './owner-password-form';
export function IdentityStatus({ verifiedAt, checkedAt }: { verifiedAt: number; checkedAt: number }) {
  const [verified, setVerified] = useState(verifiedAt), [now, setNow] = useState(checkedAt);
  useEffect(() => {
    setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000);
    const update = (event: Event) => { setVerified((event as CustomEvent<number>).detail); setNow(Date.now()); };
    window.addEventListener('identity-verified', update);
    return () => { clearInterval(timer); window.removeEventListener('identity-verified', update); };
  }, []);
  const until = verified + 5 * 60000, fresh = verified > 0 && now < until;
  return <section className="card conversation identity-status"><h2>Identity check</h2>
    {fresh ? <p className="success-message" role="status">Verified for sensitive changes until {new Date(until).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })} (PH).</p>
      : <><p className="warning-message" role="status">Confirm your password before making a sensitive change.</p><OwnerPasswordForm mode="confirm" /></>}
    <p className="muted small">You can also verify when saving a change. Your draft stays in place.</p>
  </section>;
}
