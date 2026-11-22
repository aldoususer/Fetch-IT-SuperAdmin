import Link from 'next/link';
import { db } from '@/lib/db';
export async function OwnerWorkSummary({ actorId }: { actorId: string }) {
  const [incidents, decisions] = await Promise.all([
    db.platformIncident.findMany({ where: { active: true, platformWide: true }, orderBy: { updatedAt: 'desc' }, take: 3 }),
    db.workflowCase.count({ where: { status: 'AWAITING_ADMIN', createdById: {not:actorId}, OR:[{assignedToId:null},{assignedToId:{not:actorId}}] } }),
  ]);
  return <section className="card owner-priorities" aria-labelledby="owner-priorities-title"><div className="page-heading"><h2 id="owner-priorities-title">Owner attention</h2><Link href="/dashboard/incidents">View reported incidents →</Link></div>
    {incidents.length ? <ul className="work-list">{incidents.map(incident => <li key={incident.id}><Link href="/dashboard/incidents"><strong>{incident.title}</strong><span className="muted small">{incident.scope}</span></Link><span className={`badge ${incident.severity==='CRITICAL'?'badge-red':'badge-amber'}`}>{incident.severity}</span></li>)}</ul> : <p className="muted">No active platform-wide incidents reported.</p>}
    <Link className="owner-decision" href="/dashboard/cases?status=IN_REVIEW&attention=approval"><strong>{decisions}</strong><span>Awaiting independent approval<small>Cases you did not create or review.</small></span><span aria-hidden="true">→</span></Link>
    <p className="muted small">Recorded incidents only; this is not an external service uptime check.</p>
  </section>;
}
export async function StaffWorkload() {
  const [tickets, cases] = await Promise.all([
    db.supportTicket.groupBy({ by: ['assignedAdminId'], where: { assignedAdminId: { not: null }, status: { not: 'RESOLVED' } }, _count: { _all: true } }),
    db.workflowCase.groupBy({ by: ['assignedToId'], where: { assignedToId: { not: null }, status: { not: 'RESOLVED' } }, _count: { _all: true } }),
  ]);
  const totals = new Map<string, number>();
  for (const row of tickets) if (row.assignedAdminId) totals.set(row.assignedAdminId, (totals.get(row.assignedAdminId) ?? 0) + row._count._all);
  for (const row of cases) if (row.assignedToId) totals.set(row.assignedToId, (totals.get(row.assignedToId) ?? 0) + row._count._all);
  const staff = await db.user.findMany({ where: { id: { in: [...totals.keys()] }, role: { in: ['ADMIN', 'SUPPORT', 'SAFETY'] } }, select: { id: true, name: true } });
  const ranked = staff.sort((a,b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) || a.name.localeCompare(b.name)).slice(0, 5);
  return <section className="card owner-priorities" aria-labelledby="workload-title"><div className="page-heading"><h2 id="workload-title">Staff workload</h2><Link href="/dashboard/staff">View all staff →</Link></div>
    {ranked.length ? <ul className="work-list">{ranked.map(person => <li key={person.id}><Link href={`/dashboard/staff/${person.id}`}>{person.name}</Link><strong>{totals.get(person.id)} <span className="muted small">open items</span></strong></li>)}</ul> : <p className="muted">No open assigned work.</p>}
  </section>;
}
