import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {requireStaffPage} from '@/lib/staff-access';
import {isStaffRole, ROLE_LABELS} from '@/lib/staff-policy';
import {pageNumber} from '@/lib/operations';

const size=20;
type Query=Record<string,string|string[]|undefined>;

export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Query>}) {
  await requireStaffPage('operations');
  const [{id},query]=await Promise.all([params,searchParams]);
  const person=await db.user.findUnique({where:{id},select:{id:true,name:true,email:true,role:true,isBanned:true}});
  if(!person||!isStaffRole(person.role))notFound();
  const ticketsWhere={assignedAdminId:id,status:{not:'RESOLVED' as const}};
  const casesWhere={assignedToId:id,status:{not:'RESOLVED'}};
  const [ticketCount,caseCount,activityCount,sessionCount]=await Promise.all([
    db.supportTicket.count({where:ticketsWhere}),
    db.workflowCase.count({where:casesWhere}),
    db.adminAudit.count({where:{actorId:id}}),
    db.staffSession.count({where:{userId:id,revokedAt:null,expiresAt:{gt:new Date()}}}),
  ]);
  const pages={tickets:Math.max(1,Math.ceil(ticketCount/size)),cases:Math.max(1,Math.ceil(caseCount/size)),activity:Math.max(1,Math.ceil(activityCount/size))};
  const page=(key:keyof typeof pages)=>Math.min(pageNumber(typeof query[key]==='string'?query[key]:''),pages[key]);
  const [tickets,cases,activity]=await Promise.all([
    db.supportTicket.findMany({where:ticketsWhere,orderBy:[{updatedAt:'desc'},{id:'desc'}],skip:(page('tickets')-1)*size,take:size,select:{id:true,category:true,status:true,priority:true,customer:{select:{name:true}},booking:{select:{refCode:true}}}}),
    db.workflowCase.findMany({where:casesWhere,orderBy:[{updatedAt:'desc'},{id:'desc'}],skip:(page('cases')-1)*size,take:size,select:{id:true,title:true,kind:true,status:true,priority:true}}),
    db.adminAudit.findMany({where:{actorId:id},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page('activity')-1)*size,take:size,select:{id:true,action:true,entityType:true,entityId:true,createdAt:true}}),
  ]);
  const href=(key:keyof typeof pages,next:number)=>{
    const search=new URLSearchParams();
    for(const name of ['tickets','cases','activity'] as const)search.set(name,String(name===key?next:page(name)));
    return `/dashboard/staff/${encodeURIComponent(id)}?${search}`;
  };
  const pagination=(key:keyof typeof pages)=><nav className="pagination" aria-label={`${key} pages`}><span className="muted small">Page {page(key)} of {pages[key]}</span>{page(key)>1&&<Link className="btn" href={href(key,page(key)-1)}>Previous</Link>}{page(key)<pages[key]&&<Link className="btn" href={href(key,page(key)+1)}>Next</Link>}</nav>;
  const target=(type:string,recordId:string)=>type==='SUPPORT'?`/dashboard/support/${encodeURIComponent(recordId)}`:type==='CASE'?`/dashboard/cases/${encodeURIComponent(recordId)}`:type==='BOOKING'?`/dashboard/bookings/${encodeURIComponent(recordId)}`:null;
  return <div className="staff-oversight">
    <Link href="/dashboard/staff">← Staff accounts & assigned work</Link>
    <div className="page-heading"><div><div className="eyebrow">STAFF OVERSIGHT</div><h1>{person.name}</h1><p>{person.email} · {ROLE_LABELS[person.role]} · {person.isBanned?'Disabled':'Active'}</p><p>Review this person’s assigned work and recorded actions. Interventions use your Superadmin account and require a reason.</p></div><Link className="btn" href={`/dashboard/staff#staff-${encodeURIComponent(id)}`}>Manage this staff member’s access</Link></div>
    <div className="stat-grid">{[['Open support requests',ticketCount],['Open review cases',caseCount],['Recorded actions',activityCount],['Active sign-in sessions',sessionCount]].map(([label,count])=><section className="card conversation" key={label}><p className="muted small">{label}</p><strong>{count}</strong></section>)}</div>
    <section className="card conversation"><h2>Assigned support requests</h2><p>Open a request to read the conversation, reassign it, change its status, or add coaching feedback.</p>{tickets.length?tickets.map(ticket=><p key={ticket.id}><Link href={`/dashboard/support/${ticket.id}`}>{ticket.booking?.refCode??'Account help'} · {ticket.customer.name} · {ticket.category.replaceAll('_',' ')}</Link><br/><span className="muted small">{ticket.status.replaceAll('_',' ')} · {ticket.priority}</span></p>):<p className="muted">No open support requests assigned.</p>}{pagination('tickets')}</section>
    <section className="card conversation"><h2>Assigned safety, finance & escalation cases</h2><p>Open a case to review evidence, reassign its reviewer, or record an independent decision. Existing approval rules still apply.</p>{cases.length?cases.map(record=><p key={record.id}><Link href={`/dashboard/cases/${record.id}`}>{record.title}</Link><br/><span className="muted small">{record.kind} · {record.status.replaceAll('_',' ')} · {record.priority}</span></p>):<p className="muted">No open review cases assigned.</p>}{pagination('cases')}</section>
    <section className="card conversation"><h2>Recorded staff activity</h2><p>Actions recorded under this staff member’s own account.</p>{activity.length?activity.map(record=>{const link=target(record.entityType,record.entityId);return <article className="conversation-message" key={record.id}><strong>{record.action.replaceAll('_',' ')}</strong><time dateTime={record.createdAt.toISOString()}>{record.createdAt.toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</time>{link?<Link href={link}>Open related {record.entityType.toLowerCase()} →</Link>:<span>{record.entityType} · {record.entityId}</span>}</article>;}):<p className="muted">No recorded activity yet.</p>}{pagination('activity')}</section>
  </div>;
}
