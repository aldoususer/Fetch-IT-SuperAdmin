import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {requireStaffPage} from '@/lib/staff-access';
import {supportScope,hasPermission} from '@/lib/staff-policy';
import {ActionForm} from '@/components/action-form';
import {ReplyForm} from '../reply-form';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const staff=await requireStaffPage('support');const{id}=await params;
  const ticket=await db.supportTicket.findFirst({where:{id,...supportScope(staff)},include:{customer:{select:{name:true,email:true}},booking:{select:{id:true,refCode:true}},messages:{orderBy:[{createdAt:'asc'},{id:'asc'}],take:200}}});if(!ticket)notFound();
  const [admins,notes,history]=await Promise.all([
    db.user.findMany({where:{role:{in:['ADMIN','SUPPORT','SUPPORT_SUPERVISOR']},isBanned:false,...(!hasPermission(staff.role,'support.manage')?{id:staff.id}:{})},select:{id:true,name:true},orderBy:{name:'asc'}}),
    db.supportInternalNote.findMany({where:{ticketId:id},orderBy:{createdAt:'asc'},take:100}),
    db.supportTicket.findMany({where:{AND:[supportScope(staff),{customerId:ticket.customerId}]},orderBy:{createdAt:'desc'},take:15,select:{id:true,category:true,status:true}}),
  ]);
  const stamp=(date:Date)=>date.toLocaleString('en-PH',{timeZone:'Asia/Manila'});
  return <div><Link href="/dashboard/support">← Support inbox</Link><div className="page-heading"><div><div className="eyebrow">SUPPORT CONVERSATION</div><h1>{ticket.booking?.refCode??'Account help'}</h1><p>{ticket.customer.name} · {ticket.customer.email}</p><p className="muted small">Request ID: {id}</p></div>{ticket.booking&&<Link className="btn" href={hasPermission(staff.role,'operations')?`/dashboard/bookings/${ticket.booking.id}`:`/dashboard/lookup?ref=${encodeURIComponent(ticket.booking.refCode)}`}>View relevant booking</Link>}</div>
    <div className="detail-grid"><section className="card conversation"><h2>Conversation</h2><article className="conversation-message"><strong>{ticket.customer.name}</strong><time>{stamp(ticket.createdAt)}</time><p>{ticket.message}</p></article>{ticket.messages.map(m=><article className="conversation-message" key={m.id}><strong>{m.authorName} · {m.authorRole==='CUSTOMER'?'Customer':'Support'}</strong><time>{stamp(m.createdAt)}</time><p>{m.body}</p></article>)}</section><section className="card conversation"><h2>Manage request</h2><p>Claim an unassigned request before replying. Public replies notify the customer; internal notes stay in the staff portal.</p><ReplyForm key={ticket.updatedAt.toISOString()} id={id} status={ticket.status} priority={ticket.priority} assignedAdminId={ticket.assignedAdminId??(!hasPermission(staff.role,'support.manage')?staff.id:null)} updatedAt={ticket.updatedAt.toISOString()} admins={admins}/></section></div>
    <section className="card conversation"><h2>Internal notes & reply-quality feedback</h2>{notes.map(n=><article className="conversation-message" key={n.id}><strong>{n.authorName}</strong><time>{stamp(n.createdAt)}</time><p className="preserve-lines">{n.body}</p></article>)}<ActionForm url={`/api/support/${id}/notes`} label="Append internal note" fields={[{name:'note',label:'Internal note / coaching feedback',type:'textarea',required:true}]}/></section>
    <h2>Escalate for review</h2><ActionForm url="/api/cases" hidden={{ticketId:id}} label="Send to review queue" fields={[{name:'kind',label:'Team',options:[{value:'ESCALATION',label:'Support Supervisor / Admin'},{value:'FINANCE',label:'Finance review'},{value:'SAFETY',label:'Safety review'}]},{name:'title',label:'Case title',required:true},{name:'summary',label:'Reported facts',type:'textarea',required:true},{name:'priority',label:'Priority',options:['NORMAL','HIGH','URGENT'].map(value=>({value,label:value}))}]}/>
    <section className="card conversation"><h2>Accessible support history</h2>{history.map(t=><p key={t.id}><Link href={`/dashboard/support/${t.id}`}>{t.category} · {t.status}</Link></p>)}</section></div>;
}
