import {db} from '@/lib/db';
import {requireStaffPage} from '@/lib/staff-access';
import {hasPermission} from '@/lib/staff-policy';
import {ActionForm} from '@/components/action-form';
export default async function Page(){const staff=await requireStaffPage();
  const kinds=hasPermission(staff.role,'operations')?['KNOWLEDGE','TEMPLATE','ANNOUNCEMENT','SAFETY_GUIDE']:hasPermission(staff.role,'support')?['KNOWLEDGE','TEMPLATE','ANNOUNCEMENT']:staff.role==='SAFETY'?['SAFETY_GUIDE','ANNOUNCEMENT']:['ANNOUNCEMENT'];
  const records=await db.staffResource.findMany({where:{kind:{in:kinds}},orderBy:{updatedAt:'desc'},take:100});
  return <div><h1>Knowledge & announcements</h1>{records.map(r=><article className="card conversation" key={r.id}><div className="eyebrow">{r.kind.replaceAll('_',' ')}</div><h2>{r.title}</h2><p className="preserve-lines">{r.body}</p><small>{r.updatedAt.toISOString()}</small></article>)}{!records.length&&<p>No resources have been published yet.</p>}
    {hasPermission(staff.role,'resources.edit')&&<><h2>Publish a resource</h2><ActionForm url="/api/resources" label="Publish" fields={[{name:'kind',label:'Resource type',options:(hasPermission(staff.role,'operations')?kinds:['KNOWLEDGE','TEMPLATE']).map(value=>({value,label:value.replaceAll('_',' ')}))},{name:'title',label:'Title',required:true},{name:'body',label:'Content',type:'textarea',required:true}]}/></>}</div>;
}
