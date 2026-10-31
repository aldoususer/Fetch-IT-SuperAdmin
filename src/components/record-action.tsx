"use client";
import {useId,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useVerifiedRequest} from './identity-verification';

type Intent={url:string;action:string;label:string;title:string;effect:string;target:string;details?:{label:string;value:string}[];reasonHelp:string;success:string;danger?:boolean};
export function RecordAction({disabled=false,...props}:Intent&{disabled?:boolean}){
 const router=useRouter(),request=useVerifiedRequest(),dialog=useRef<HTMLDialogElement>(null),pending=useRef(false),id=useId();
 const [intent,setIntent]=useState<Intent>(props),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[conflict,setConflict]=useState(false);
 async function save(event:React.FormEvent){
  event.preventDefault();if(pending.current||conflict)return;
  const explanation=reason.trim();
  if(!explanation||explanation.length>500){setError('Enter a reason of 1–500 characters.');return;}
  pending.current=true;setBusy(true);setError('');setMessage('');
  try{
   const response=await request(intent.url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:intent.action,reason:explanation})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok){setConflict(response.status===409);throw new Error(result.error||'Could not save this change. Your reason is kept. Please try again.');}
   dialog.current?.close();setReason('');setMessage(result.message||intent.success);router.refresh();
  }catch(cause){setError(cause instanceof TypeError?'Could not reach the server. Your reason is kept. Please try again.':cause instanceof Error?cause.message:'Could not save this change. Your reason is kept.');}
  finally{pending.current=false;setBusy(false);}
 }
 return <div className="record-action">
 <button type="button" className={'btn '+(props.danger?'btn-danger':'')} disabled={disabled||busy} onClick={()=>{setIntent(props);setError('');setMessage('');setConflict(false);dialog.current?.showModal();}}>{props.label}</button>
 {message&&<p className="success-message" role="status">{message}</p>}
 <dialog ref={dialog} className="inbox-dialog" aria-labelledby={id+'-title'} aria-describedby={id+'-effect'} onCancel={event=>{if(pending.current)event.preventDefault();}}>
 <form className="record-action-form" aria-busy={busy} onSubmit={save}><h2 id={id+'-title'}>{intent.title}</h2>
 <p className="action-target"><strong>{intent.target}</strong></p>
 {intent.details?.length? <dl className="change-list">{intent.details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>:null}
 <p id={id+'-effect'}>{intent.effect}</p>
 <label htmlFor={id+'-reason'}>Reason <span className="muted">(required)</span></label>
 <textarea id={id+'-reason'} className="input" value={reason} maxLength={500} required disabled={busy} aria-describedby={id+'-help'} onChange={event=>setReason(event.target.value)}/>
 <small id={id+'-help'}>{intent.reasonHelp} Up to 500 characters.</small>
 {error&&<p className="error-message" role="alert">{error}</p>}
 {conflict&&<p className="warning-message">No change was saved. Refresh the record and review its current status before trying again.</p>}
 <div className="staff-actions"><button autoFocus type="button" className="btn" disabled={busy} onClick={()=>dialog.current?.close()}>Cancel</button>
 {conflict?<button type="button" className="btn" onClick={()=>{dialog.current?.close();router.refresh();}}>Close & refresh record</button>:<button className={'btn '+(intent.danger?'btn-danger':'btn-primary')} disabled={busy}>{busy?'Saving…':intent.label}</button>}</div>
 </form></dialog></div>;
}
