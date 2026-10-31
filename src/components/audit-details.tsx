import {describeChanges} from '@/lib/ux-labels';
function redact(value:unknown):unknown{
 if(Array.isArray(value))return value.map(redact);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/password|secret|token|hash/i.test(key)?'[Hidden]':redact(item)]));
 return value;
}
export function AuditDetails({details}:{details:unknown}){
 const record=details&&typeof details==='object'&&!Array.isArray(details)?details as Record<string,unknown>:{};
 const changes=describeChanges(record.before,record.after);
 return <>{typeof record.reason==='string'&&<p><strong>Reason:</strong> {record.reason}</p>}{typeof record.method==='string'&&<p><strong>Method:</strong> {record.method}</p>}
 {changes.length>0&&<div className="table-card"><table><thead><tr><th>What changed</th><th>Before</th><th>After</th></tr></thead><tbody>{changes.map((change,index)=><tr key={index}><td>{change.field}</td><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table></div>}
 <details><summary>Technical details</summary><pre className="audit-json">{JSON.stringify(redact(details),null,2)}</pre></details></>;
}
