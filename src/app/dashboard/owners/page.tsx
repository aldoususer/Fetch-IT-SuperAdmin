import {db} from '@/lib/db';
import {requireStaffPage} from '@/lib/staff-access';
import {ActionForm} from '@/components/action-form';
export default async function Page() {
  await requireStaffPage();
  const owners = await db.ownerIdentity.findMany({select: {id: true, name: true, email: true, active: true, passwordChangedAt: true}, orderBy: {createdAt: 'asc'}});
  return <div><h1>Approved owners</h1><p>Invite another trusted owner using a separate email. Their private password setup code is shown once and expires after 30 minutes.</p><ActionForm url="/api/owners" hidden={{action: 'invite'}} label="Invite an approved owner" confirm fields={[{name: 'name', label: 'Owner name', required: true}, {name: 'email', label: 'Separate owner email', type: 'email', required: true}]}/>{owners.map(owner => <section className="card conversation" key={owner.id}><h2>{owner.name}</h2><p>{owner.email} · {owner.active ? 'Active' : 'Disabled'} · {owner.passwordChangedAt ? 'Password configured' : 'Awaiting password setup'}</p><ActionForm url="/api/owners" hidden={{action: owner.active ? 'disable' : 'activate', id: owner.id}} label={owner.active ? 'Disable owner & revoke sessions' : 'Activate owner'} confirm/></section>)}</div>;
}
