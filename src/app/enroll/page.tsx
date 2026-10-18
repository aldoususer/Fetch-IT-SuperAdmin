import Link from 'next/link';
import {OwnerPasswordForm} from '@/components/owner-password-form';
export default function Page() {
  return <main className="owner-login"><section className="card conversation"><div className="eyebrow">APPROVED OWNER SETUP</div><h1>Set your password</h1><p>Use your approved email and private setup code to choose a password. Setup codes work once and expire after 30 minutes.</p><OwnerPasswordForm mode="setup"/><Link href="/login">Back to sign-in</Link></section></main>;
}
