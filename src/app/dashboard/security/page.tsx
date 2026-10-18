import {db} from '@/lib/db';
import {currentOwner} from '@/lib/owner-auth';
import {redirect} from 'next/navigation';
import {ActionForm} from '@/components/action-form';
import {OwnerPasswordForm} from '@/components/owner-password-form';
export default async function Page() {
  const owner = await currentOwner();
  if (!owner) redirect('/login');
  const sessions = await db.ownerSession.findMany({where: {revokedAt: null, expiresAt: {gt: new Date()}}, include: {owner: {select: {name: true}}}, orderBy: {createdAt: 'desc'}, take: 100});
  return <div><h1>Security & sessions</h1><p>Sessions expire after one hour or 15 minutes of inactivity. Confirm your password again before changes when your last verification is over five minutes old.</p><h2>Confirm identity</h2><OwnerPasswordForm mode="confirm"/><h2>Change your password</h2><p>Changing your password signs out your other sessions.</p><OwnerPasswordForm mode="change-password"/><h2>Active owner sessions</h2>{sessions.map(session => <section key={session.id}><p>{session.owner.name} · Last activity {session.lastSeenAt.toISOString()}{session.id === owner.sessionId ? ' · This session' : ''}</p><ActionForm url="/api/owners" hidden={{action: 'revoke-session', id: session.id}} label="Revoke session" confirm/></section>)}<p>For a forgotten password, an authorized maintenance operator can issue a private reset code. Email alone does not grant owner access.</p></div>;
}
