import Link from 'next/link';
import {PasskeyControls} from '@/components/passkey-controls';
export default function Page(){return <main className="owner-login"><section className="card conversation"><div className="eyebrow">FETCH · OWNER CONSOLE</div><h1>Superadmin sign-in</h1><p>Use your approved passkey or security key. Your device will ask for fingerprint, face, or PIN verification.</p><PasskeyControls/><Link href="/enroll">Enroll an approved owner</Link><p className="muted small">There is no public signup. Staff accounts belong in the Staff Portal.</p></section></main>;}
