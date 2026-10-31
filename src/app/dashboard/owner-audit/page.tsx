import Link from 'next/link';
import {db} from '@/lib/db';
import {requireStaffPage} from '@/lib/staff-access';
import {dateBounds,pageNumber} from '@/lib/operations';
import {eventTitle,phTime} from '@/lib/ux-labels';
import {AuditDetails} from '@/components/audit-details';
import type {Prisma} from '@prisma/client';
const groups:Record<string,{label:string;prefix:string}>={staff:{label:'Staff access',prefix:'STAFF_'},settings:{label:'Platform rules',prefix:'PLATFORM_'},authentication:{label:'Sign-in & password',prefix:'OWNER_PASSWORD_'},accounts:{label:'Superadmin accounts & sessions',prefix:'OWNER_'}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireStaffPage();const query=await searchParams,value=(key:string)=>typeof query[key]==='string'?query[key] as string:'',q=value('q').trim().slice(0,100),category=value('category');
 let error='',dates={};try{dates=dateBounds(value('from'),value('to'));}catch(cause){error=cause instanceof Error?cause.message:'Choose valid dates.';}
 const where:Prisma.OwnerAuditWhereInput={createdAt:dates,...(groups[category]?{action:{startsWith:groups[category].prefix,...(category==='accounts'?{not:{startsWith:'OWNER_PASSWORD_'}}:{})}}:{}),...(q?{OR:[{actorName:{contains:q,mode:'insensitive'}},{entityId:{contains:q,mode:'insensitive'}},{action:{contains:q.replaceAll(' ','_'),mode:'insensitive'}}]}:{})};
 const total=error?0:await db.ownerAudit.count({where}),pages=Math.max(1,Math.ceil(total/20)),page=Math.min(pageNumber(value('page')),pages);
 const records=error?[]:await db.ownerAudit.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:20,skip:(page-1)*20});
 const href=(n:number)=>'/dashboard/owner-audit?'+new URLSearchParams({q,category,from:value('from'),to:value('to'),page:String(n)});
 return <div><h1>Platform activity history</h1><p>Who changed access or platform rules, when it happened, and why. All times are Philippine time.</p>
 <form className="card filters"><label>Search activity<input className="input" name="q" defaultValue={q} maxLength={100} placeholder="Person, action, or record ID"/></label><label>Activity type<select className="input" name="category" defaultValue={category}><option value="">All activity</option>{Object.entries(groups).map(([key,group])=><option key={key} value={key}>{group.label}</option>)}</select></label><label>From date<input className="input" type="date" name="from" defaultValue={value('from')}/></label><label>To date<input className="input" type="date" name="to" defaultValue={value('to')}/></label><div className="filter-actions"><button className="btn btn-primary">Search history</button><Link className="btn" href="/dashboard/owner-audit">Clear filters</Link></div></form>
 {error&&<p role="alert" className="error-message">{error}</p>}
 {records.map(record=><article className="card conversation" key={record.id}><time className="muted" dateTime={record.createdAt.toISOString()}>{phTime(record.createdAt)}</time><h2>{eventTitle(record.action)}</h2><p>By <strong>{record.actorName}</strong></p><AuditDetails details={record.details}/><details><summary>Related record</summary><p className="muted">{record.entityId}</p></details></article>)}
 {!records.length&&!error&&<p className="card empty-state">No activity matches these filters.</p>}
 <nav className="pagination" aria-label="Activity history pages"><span>{total} events · Page {page} of {pages}</span>{page>1&&<Link className="btn" href={href(page-1)}>Previous</Link>}{page<pages&&<Link className="btn" href={href(page+1)}>Next</Link>}</nav></div>;
}
