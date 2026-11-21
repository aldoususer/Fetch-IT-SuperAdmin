import {db} from '@/lib/db';
import {currentOwner} from '@/lib/owner-auth';
import {redirect} from 'next/navigation';
import {ActionForm} from '@/components/action-form';
import {OwnerPasswordForm} from '@/components/owner-password-form';
import {IdentityStatus} from '@/components/identity-status';
import {phTime} from '@/lib/ux-labels';
export default async function Page(){
 const owner=await currentOwner();if(!owner)redirect('/login');
 const sessions=await db.ownerSession.findMany({where:{revokedAt:null,expiresAt:{gt:new Date()},lastSeenAt:{gt:new Date(Date.now()-15*60000)}},include:{owner:{select:{name:true}}},orderBy:{createdAt:'desc'},take:100});
 return <div><h1>Security & sessions</h1><p>Sign-in sessions end after one hour or 15 minutes without activity. Changes require an identity check within the last five minutes.</p>
 <IdentityStatus verifiedAt={owner.verifiedAt.getTime()} checkedAt={Date.now()}/>
 <section className="card conversation"><h2>Active Superadmin sessions</h2>{sessions.map(session=><div className="session-row" key={session.id}><h3>{session.owner.name} {session.id===owner.sessionId&&<span className="badge badge-green">This session</span>}</h3><p>Last active: {phTime(session.lastSeenAt)}<br/>Expires: {phTime(session.expiresAt)}</p><ActionForm url="/api/owners" hidden={{action:'revoke-session',id:session.id}} label={session.id===owner.sessionId?'Sign out this session':'Sign out session'} confirm confirmation={session.id===owner.sessionId?'Sign out this session? You will need to sign in again.':'End this sign-in session? Other sessions stay signed in.'}/></div>)}</section>
 <details className="card conversation"><summary>Change your password</summary><p>Use a unique password. Changing it signs out other devices.</p><OwnerPasswordForm mode="change-password"/></details>
 <p>If you forget your password, an authorized maintenance operator can provide a private reset code. Knowing an email address does not grant Superadmin access.</p></div>;
}
