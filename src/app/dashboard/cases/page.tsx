import Link from 'next/link';
import {db} from '@/lib/db';
import {requireStaffPage} from '@/lib/staff-access';
import {caseScope,hasPermission} from '@/lib/staff-policy';
import {ActionForm} from '@/components/action-form';
export default async function Page(){
  const staff=await requireStaffPage();
  const records=await db.workflowCase.findMany({where:caseScope(staff),orderBy:{updatedAt:'desc'},take:100});
  const kinds=hasPermission(staff.role,'operations')||hasPermission(staff.role,'support')?['ESCALATION','FINANCE','SAFETY']:staff.role==='FINANCE'?['FINANCE']:['SAFETY'];
  return <div><div className="page-heading"><div><div className="eyebrow">TEAM REVIEWS</div><h1>Reviews & escalations</h1><p>Investigate, recommend, and track the operational decision. Online refunds and payouts are simulated.</p></div></div>
    <div className="card table-card"><table><thead><tr><th>Case</th><th>Team</th><th>Priority</th><th>Status</th></tr></thead><tbody>{records.map(r=><tr key={r.id}><td><Link href={`/dashboard/cases/${r.id}`}>{r.title}</Link></td><td>{r.kind}</td><td>{r.priority}</td><td>{r.status.replaceAll('_',' ')}</td></tr>)}</tbody></table>{!records.length&&<p className="empty-state">No cases in your review queue.</p>}</div>
    <h2>Open a review</h2><ActionForm url="/api/cases" label="Submit review" fields={[{name:'kind',label:'Team',options:kinds.map(value=>({value,label:value}))},{name:'title',label:'Title',required:true},{name:'summary',label:'Issue and supporting facts',type:'textarea',required:true},{name:'ticketId',label:'Support request ID (required when routing to another team)'},{name:'bookingRef',label:'Booking reference (optional)'},{name:'priority',label:'Priority',options:['NORMAL','HIGH','URGENT','LOW'].map(value=>({value,label:value}))}]}/></div>;
}
