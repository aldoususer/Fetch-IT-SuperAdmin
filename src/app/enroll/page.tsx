import Link from 'next/link';
import {PasskeyControls} from '@/components/passkey-controls';
export default function Page(){return <main className="owner-login"><section className="card conversation"><div className="eyebrow">APPROVED OWNER ENROLLMENT</div><h1>Register your passkey</h1><p>Enter the one-time enrollment token issued by an approved owner or the bootstrap command. Tokens expire after 30 minutes.</p><PasskeyControls enrollment/><Link href="/login">Back to sign-in</Link></section></main>;}
