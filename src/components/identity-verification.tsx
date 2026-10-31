"use client";
import {createContext,useContext,useId,useRef,useState,type ReactNode} from 'react';
type Request=(url:string,init:RequestInit)=>Promise<Response>;
const RequestContext=createContext<Request>((url,init)=>fetch(url,init));
export const useVerifiedRequest=()=>useContext(RequestContext);
export function IdentityVerificationProvider({children}:{children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),pending=useRef<{resolve:()=>void;reject:(error:Error)=>void}|null>(null),lock=useRef(false),id=useId();
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 function cancel(){if(lock.current)return;pending.current?.reject(new Error('Verification cancelled. Your changes have not been saved.'));pending.current=null;setPassword('');dialog.current?.close();}
 const request:Request=async(url,init)=>{
  const response=await fetch(url,init);
  if(response.status!==401)return response;
  const body=await response.clone().json().catch(()=>({}));
  if(!/confirm your password/i.test(body.error??'')&&body.code!=='VERIFICATION_REQUIRED')return response;
  await new Promise<void>((resolve,reject)=>{
   if(pending.current){reject(new Error('Finish the current identity check first.'));return;}
   pending.current={resolve,reject};setPassword('');setError('');dialog.current?.showModal();
  });
  return fetch(url,init);
 };
 async function verify(event:React.FormEvent){
  event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/owner-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'confirm',password})});
   setPassword('');const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Could not verify your identity.');
   window.dispatchEvent(new CustomEvent('identity-verified',{detail:Date.now()}));
   const waiting=pending.current;pending.current=null;dialog.current?.close();waiting?.resolve();
  }catch(error){setError(error instanceof Error?error.message:'Please try again.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <RequestContext.Provider value={request}>{children}<dialog ref={dialog} className="inbox-dialog" aria-labelledby={id} onCancel={event=>{event.preventDefault();cancel();}}>
 <form onSubmit={verify}><h2 id={id}>Verify identity to continue</h2><p>Your last identity check has expired. Enter your password to continue with this change. Your entered details are kept.</p>
 <label>Password<input className="input" type="password" autoComplete="current-password" required autoFocus maxLength={128} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></label>
 {error&&<p role="alert" className="error-message">{error}</p>}<div className="staff-actions"><button type="button" className="btn" disabled={busy} onClick={cancel}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy?'Verifying…':'Verify & continue'}</button></div></form>
 </dialog></RequestContext.Provider>;
}
