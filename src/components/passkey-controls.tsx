"use client";
import {useState} from 'react';
import {useRouter,usePathname} from 'next/navigation';
import {startAuthentication,startRegistration} from '@simplewebauthn/browser';
export function PasskeyControls({enrollment=false,addKey=false}:{enrollment?:boolean;addKey?:boolean}){
  const router=useRouter(),pathname=usePathname();const[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[token,setToken]=useState(''),[label,setLabel]=useState('');
  async function send(body:object){const res=await fetch('/api/owner-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw new Error(data.error);return data;}
  return <form className="staff-form" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{const register=enrollment||addKey;const data=await send({action:register?'enroll-options':'options',token});const response=register?await startRegistration({optionsJSON:data.options}):await startAuthentication({optionsJSON:data.options});await send({action:register?'enroll-verify':'verify',response,label});setToken('');setMessage(register?'Passkey registered.':'Identity confirmed.');if(pathname==='/login'||pathname==='/enroll')router.push('/dashboard');router.refresh();}catch(error){setMessage(error instanceof Error?error.message:'Passkey action failed.');}finally{setBusy(false);}}}>
    {enrollment&&<label>Approved enrollment token<input type="password" className="input" value={token} onChange={e=>setToken(e.target.value)} required autoComplete="off"/></label>}{(enrollment||addKey)&&<label>Key label<input className="input" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Office key / spare key" maxLength={80}/></label>}
    {message&&<p role="status">{message}</p>}<button className="btn btn-primary" disabled={busy}>{busy?'Waiting for your passkey…':enrollment?'Register approved owner passkey':addKey?'Add a spare passkey':'Continue with passkey'}</button>
  </form>;
}

