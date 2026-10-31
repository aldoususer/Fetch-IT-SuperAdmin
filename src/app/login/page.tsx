import Link from 'next/link';
import {OwnerPasswordForm} from '@/components/owner-password-form';
export default function Page() {
  return <main className="owner-login"><section className="card conversation"><div className="eyebrow">FETCH · SUPERADMIN</div><h1>Superadmin sign-in</h1><p>Sign in with your approved Superadmin email and password.</p><OwnerPasswordForm/><Link href="/enroll">Set or reset your Superadmin password</Link><p className="muted small">Only approved Superadmin accounts can sign in. Staff use the Staff Portal.</p></section></main>;
}
