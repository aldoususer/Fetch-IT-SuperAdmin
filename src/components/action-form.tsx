"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
type Field={name:string;label:string;type?:string;value?:string|number;options?:{value:string;label:string}[];required?:boolean};
export function ActionForm({url,method="POST",fields=[],hidden={},label="Save",confirm=false}:{url:string;method?:string;fields?:Field[];hidden?:Record<string,unknown>;label?:string;confirm?:boolean}) {
  const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <form className="card staff-form" onSubmit={async e=>{e.preventDefault();if(busy)return;if(confirm&&!window.confirm(`Confirm: ${label}?`))return;
    const data=new FormData(e.currentTarget);const body:Record<string,unknown>={...hidden};fields.forEach(f=>body[f.name]=f.type==='number'?Number(data.get(f.name)):data.get(f.name));
    setBusy(true);setMessage('');try{const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save.');setMessage(result.message||'Saved.');if(result.redirect){router.push(result.redirect);}router.refresh();}catch(error){setMessage(error instanceof Error?error.message:'Please retry.');}finally{setBusy(false);}
  }}>
    {fields.map(f=><label key={f.name}>{f.label}{f.options?<select className="input" name={f.name} defaultValue={f.value} required={f.required}>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:f.type==='textarea'?<textarea className="input" name={f.name} defaultValue={f.value} required={f.required} maxLength={4000}/>:<input className="input" name={f.name} type={f.type||'text'} defaultValue={f.value} required={f.required} maxLength={f.type==='password'?128:500}/>}</label>)}
    {message&&<p role="status">{message}</p>}<button className="btn btn-primary" disabled={busy}>{busy?'Saving…':label}</button>
  </form>;
}
