import Link from 'next/link';
import {db} from '@/lib/db';
import {requireStaffPage} from '@/lib/staff-access';
import {STAFF_ROLES,ROLE_LABELS} from '@/lib/staff-policy';
import type {Prisma} from '@prisma/client';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireStaffPage('operations');
 const query=await searchParams,q=typeof query.q==='string'?query.q.trim().slice(0,100):'';
 const where:Prisma.UserWhereInput={role:{in:[...STAFF_ROLES,'FINANCE']},...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}}]}:{})};
 const total=await db.user.count({where}),pages=Math.max(1,Math.ceil(total/20)),requested=Number(query.page),page=Math.min(pages,Number.isSafeInteger(requested)&&requested>0?requested:1);
 const people=await db.user.findMany({where,select:{id:true,name:true,email:true,role:true,isBanned:true},orderBy:[{name:'asc'},{id:'asc'}],take:20,skip:(page-1)*20});
 const ids=people.map(p=>p.id);
 const [tickets,cases]=await Promise.all([
 db.supportTicket.groupBy({by:['assignedAdminId'],where:{assignedAdminId:{in:ids},status:{not:'RESOLVED'}},_count:{_all:true}}),
 db.workflowCase.groupBy({by:['assignedToId'],where:{assignedToId:{in:ids},status:{not:'RESOLVED'}},_count:{_all:true}}),
 ]);
 const work=new Map<string,number>();
 for(const row of tickets)if(row.assignedAdminId)work.set(row.assignedAdminId,row._count._all);
 for(const row of cases)if(row.assignedToId)work.set(row.assignedToId,(work.get(row.assignedToId)??0)+row._count._all);
 const href=(n:number)=>'/dashboard/staff?'+new URLSearchParams({q,page:String(n)});
 return <div><div className="page-heading"><div><div className="eyebrow">ACCESS MANAGEMENT</div><h1>Staff & permissions</h1><p>Find a person, review their work, or manage their access.</p></div><Link className="btn btn-primary" href="/dashboard/staff/new">Add staff member</Link></div>
 <form className="card filters"><label>Search staff<input className="input" name="q" defaultValue={q} maxLength={100} placeholder="Name or email"/></label><button className="btn">Search</button>{q&&<Link className="btn" href="/dashboard/staff">Clear search</Link>}</form>
 <div className="card table-card"><table className="responsive-table"><thead><tr><th>Name</th><th>Role</th><th>Account status</th><th>Open work</th><th>Details</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td data-label="Name"><strong>{p.name}</strong><br/><small>{p.email}</small></td><td data-label="Role">{ROLE_LABELS[p.role]}</td><td data-label="Account status"><span className={'badge '+(p.isBanned?'badge-red':p.role==='FINANCE'?'badge-amber':'badge-green')}>{p.isBanned?'Disabled':p.role==='FINANCE'?'Role retired':'Active'}</span></td><td data-label="Open work">{work.get(p.id)??0}</td><td data-label="Details"><Link className="btn" href={'/dashboard/staff/'+p.id}>View details<span className="sr-only"> for {p.name}</span></Link></td></tr>)}</tbody></table>{!people.length&&<p className="empty-state">No staff match your search.</p>}</div>
 <nav className="pagination" aria-label="Staff pages"><span>{total} staff · Page {page} of {pages}</span>{page>1&&<Link className="btn" href={href(page-1)}>Previous</Link>}{page<pages&&<Link className="btn" href={href(page+1)}>Next</Link>}</nav>
 </div>;
}
