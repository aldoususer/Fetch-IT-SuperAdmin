import {db} from '@/lib/db';
import {requireStaffPage} from '@/lib/staff-access';
export default async function Page(){await requireStaffPage('support.manage');
  const people=await db.user.findMany({where:{isBanned:false,role:{in:['SUPPORT','SUPPORT_SUPERVISOR','ADMIN']}},select:{id:true,name:true,role:true},orderBy:{name:'asc'}});
  const counts=await db.supportTicket.groupBy({by:['assignedAdminId','status'],_count:true});
  return <div><h1>Support team workload</h1><p>Assign tickets from their detail page. Account creation, disablement, and permission changes belong to Superadmin.</p><div className="card table-card"><table><thead><tr><th>Staff member</th><th>Open / in progress</th><th>Resolved</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td>{p.name} · {p.role.replaceAll('_',' ')}</td><td>{counts.filter(c=>c.assignedAdminId===p.id&&c.status!=='RESOLVED').reduce((sum,c)=>sum+c._count,0)}</td><td>{counts.find(c=>c.assignedAdminId===p.id&&c.status==='RESOLVED')?._count??0}</td></tr>)}</tbody></table></div><p>Ticket totals measure workload, not customer satisfaction or response quality.</p></div>;
}
