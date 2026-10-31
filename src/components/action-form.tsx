"use client";
import {useId,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useVerifiedRequest} from './identity-verification';
type Field={name:string;label:string;type?:string;value?:string|number;options?:{value:string;label:string}[];required?:boolean;autoComplete?:string;minLength?:number;maxLength?:number;help?:string;onChange?:(value:string)=>void};
export function ActionForm({url,method='POST',fields=[],hidden={},label='Save',confirm=false,confirmation='Review the information you entered before confirming this change.'}:{url:string;method?:string;fields?:Field[];hidden?:Record<string,unknown>;label?:string;confirm?:boolean;confirmation?:string}){
 const router=useRouter(),request=useVerifiedRequest(),form=useRef<HTMLFormElement>(null),dialog=useRef<HTMLDialogElement>(null),pending=useRef(false),snapshot=useRef<Record<string,unknown>>({}),id=useId();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[confirming,setConfirming]=useState(false);
 async function save(){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');setMessage('');setConflict(false);
  try{
   const response=await request(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot.current)}),result=await response.json();
   if(!response.ok){setConflict(response.status===409);throw new Error(result.error||'Could not save. Your entered details are kept.');}
   dialog.current?.close();setConfirming(false);form.current?.reset();snapshot.current={};setMessage(result.message||'Change saved.');if(result.redirect)router.push(result.redirect);router.refresh();
  }catch(error){setError(error instanceof Error?error.message:'Please retry.');}
  finally{pending.current=false;setBusy(false);}
 }
 return <><form ref={form} className="card staff-form" aria-busy={busy} onSubmit={event=>{
  event.preventDefault();if(pending.current)return;
  const data=new FormData(event.currentTarget),body:Record<string,unknown>={...hidden};
  fields.forEach(field=>body[field.name]=field.type==='number'?Number(data.get(field.name)):data.get(field.name));
  snapshot.current=body;setError('');setMessage('');
  if(confirm){setConfirming(true);dialog.current?.showModal();}else void save();
 }}><fieldset disabled={busy}>{fields.map(field=><label key={field.name} htmlFor={id+'-'+field.name}><span id={id+'-'+field.name+'-label'}>{field.label}</span>{
 field.options?<select id={id+'-'+field.name} aria-labelledby={id+'-'+field.name+'-label'} className="input" name={field.name} defaultValue={field.value} required={field.required} aria-describedby={field.help?id+'-'+field.name+'-help':undefined} onChange={event=>field.onChange?.(event.target.value)}>{field.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:
 field.type==='textarea'?<textarea id={id+'-'+field.name} aria-labelledby={id+'-'+field.name+'-label'} className="input" name={field.name} defaultValue={field.value} required={field.required} maxLength={field.maxLength??(field.name==="reason"?500:4000)}/>:
 <input id={id+'-'+field.name} aria-labelledby={id+'-'+field.name+'-label'} className="input" name={field.name} type={field.type||'text'} defaultValue={field.value} required={field.required} autoComplete={field.autoComplete} minLength={field.minLength} maxLength={field.type==='password'?128:500} aria-describedby={field.help?id+'-'+field.name+'-help':undefined}/>}
 {field.help&&<small id={id+'-'+field.name+'-help'}>{field.help}</small>}</label>)}</fieldset>
 {message&&<p role="status" className="success-message">{message}</p>}{error&&!confirming&&<p role="alert" className="error-message">{error}</p>}{conflict&&<button className="btn" type="button" onClick={()=>{dialog.current?.close();router.refresh();}}>Refresh record (keep entered text)</button>}<button className="btn btn-primary" disabled={busy}>{busy?'Saving…':label}</button></form>
 <dialog ref={dialog} className="inbox-dialog" aria-labelledby={id} onClose={()=>setConfirming(false)} onCancel={event=>{if(pending.current)event.preventDefault();}}><h2 id={id}>{label}?</h2><p>{confirmation}</p><dl className="change-list">{fields.filter(field=>field.type!=='password').map(field=><div key={field.name}><dt>{field.label}</dt><dd>{field.options?.find(option=>option.value===snapshot.current[field.name])?.label??String(snapshot.current[field.name]??'')}</dd></div>)}</dl>{error&&<p role="alert" className="error-message">{error}</p>}<div className="staff-actions"><button autoFocus className="btn" disabled={busy} onClick={()=>dialog.current?.close()}>Back to form</button><button className="btn btn-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':label}</button></div></dialog></>;
}
