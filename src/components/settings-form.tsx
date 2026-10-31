"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {PlatformSettings} from '@/lib/platform-policy';
import {configuredSurge} from '@/lib/platform-policy';
import {FARE_NUMBER_RULES,SETTING_NUMBER_RULES,settingsUpdateIssues,validateSettingsUpdate} from '@/lib/settings-limits';
import {describeChanges} from '@/lib/ux-labels';
import {SettingsNumberInput} from './settings-number-input';
import {useVerifiedRequest} from './identity-verification';
import {VEHICLES} from '@/lib/pricing-defaults';
import {computeFare} from '@/lib/pricing-engine';
const sections=['Service availability','Pricing by vehicle','Commission','Booking offers'] as const;
export function SettingsForm({initial,version}:{initial:PlatformSettings;version:number}){
 const router=useRouter(),request=useVerifiedRequest(),dialog=useRef<HTMLDialogElement>(null),pending=useRef(false),leaving=useRef(false),discardDialog=useRef<HTMLDialogElement>(null),titleId=useId(),discardTitle=useId();
 const [discard,setDiscard]=useState<{kind:'discard'|'leave'|'reload';href?:string}>({kind:'discard'});
 const [baseline,setBaseline]=useState(initial),[savedVersion,setSavedVersion]=useState(version),[settings,setSettings]=useState(initial),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[conflict,setConflict]=useState(false),[section,setSection]=useState<string>(sections[0]);
 const [vehicle,setVehicle]=useState<'MOTORCYCLE'|'TRICYCLE'|'SEDAN'>('MOTORCYCLE'),[distance,setDistance]=useState(5),[weight,setWeight]=useState(1);
 const issues=settingsUpdateIssues(settings),hasInvalidNumbers=Object.keys(issues).length>0,changes=describeChanges(baseline,settings),dirty=changes.length>0;
 useEffect(()=>{
  if(!dirty)return;
  const warn=(event:BeforeUnloadEvent)=>{if(!leaving.current)event.preventDefault();};
  const navigate=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const link=(event.target as Element)?.closest('a');
   if(link&&link.href!==window.location.href&&!link.hasAttribute('download')&&link.target!=='_blank'){event.preventDefault();event.stopPropagation();setDiscard({kind:'leave',href:link.href});discardDialog.current?.showModal();}
  };
  window.addEventListener('beforeunload',warn);document.addEventListener('click',navigate,true);
  return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',navigate,true);};
 },[dirty]);
 const quote=(config:PlatformSettings)=>!hasInvalidNumbers&&Number.isFinite(distance)&&distance>=0&&Number.isFinite(weight)&&weight>=0?computeFare({distanceKm:distance,cargoWeightKg:weight,vehicle:{...VEHICLES[vehicle],...config.fares[vehicle]},surgeMultiplier:configuredSurge(config)}):null;
 const fare=quote(settings),previousFare=quote(baseline);
 async function save(){
  if(pending.current)return;pending.current=true;setBusy(true);setMessage('');setFailed(false);setConflict(false);
  try{
   const res=await request('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:savedVersion,settings,reason})}),data=await res.json();
   if(!res.ok){setConflict(res.status===409);throw new Error(data.error||'Could not save settings. Your draft is kept.');}
   setBaseline(settings);setSavedVersion(data.version??savedVersion+1);setReason('');dialog.current?.close();setMessage(data.message||'Platform rules saved for future bookings.');router.refresh();
  }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Please retry.');}
  finally{pending.current=false;setBusy(false);}
 }
 const numberFields=(keys:(keyof typeof SETTING_NUMBER_RULES)[])=>keys.map(key=><SettingsNumberInput key={key} id={key} value={settings[key]} previous={baseline[key]} rule={SETTING_NUMBER_RULES[key]} error={issues[key]} onChange={value=>setSettings({...settings,[key]:value})}/>);
 return <><form className="staff-form" aria-busy={busy} onChange={()=>{if(!busy)setMessage('');}} onSubmit={event=>{
  event.preventDefault();if(pending.current||!dirty)return;
  try{validateSettingsUpdate(settings);if(!reason.trim())throw new Error('Enter a reason for these changes.');}
  catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Correct the highlighted settings.');return;}
  setMessage('');dialog.current?.showModal();
 }}>
 <p className={dirty?'warning-message':'muted'} role="status">{dirty?changes.length+' unsaved change'+(changes.length===1?'':'s'):'All settings are saved.'}</p>
 <nav className="section-tabs" aria-label="Settings sections">{sections.map(name=><button type="button" key={name} className={'btn '+(section===name?'btn-primary':'')} aria-pressed={section===name} onClick={()=>setSection(name)}>{name}</button>)}</nav>
 <fieldset hidden={section!==sections[0]} disabled={busy}><legend>Service availability</legend><p>These controls affect new bookings. Active jobs continue.</p>{(['rideEnabled','deliveryEnabled'] as const).map(key=><label className="owner-check" key={key}><input type="checkbox" checked={settings[key]} onChange={event=>setSettings({...settings,[key]:event.target.checked})}/>{key==='rideEnabled'?'Accept new ride bookings':'Accept new delivery bookings'}</label>)}<h3>Available vehicles</h3>{(['MOTORCYCLE','TRICYCLE','SEDAN'] as const).map(id=><label className="owner-check" key={id}><input type="checkbox" checked={settings.vehicles.includes(id)} onChange={event=>setSettings({...settings,vehicles:event.target.checked?[...settings.vehicles,id]:settings.vehicles.filter(v=>v!==id)})}/>{VEHICLES[id].label}</label>)}</fieldset>
 <fieldset hidden={section!==sections[1]} disabled={busy}><legend>Pricing by vehicle</legend><p>Each field shows its allowed range and currently saved value.</p>{(['MOTORCYCLE','TRICYCLE','SEDAN'] as const).map(id=><details key={id} open={id==='MOTORCYCLE'}><summary>{VEHICLES[id].label} fares</summary><div className="owner-fields">{Object.entries(FARE_NUMBER_RULES).map(([key,rule])=>{const field=key as keyof typeof FARE_NUMBER_RULES;return <SettingsNumberInput key={key} id={'fare-'+id+'-'+key} value={settings.fares[id][field]} previous={baseline.fares[id][field]} rule={rule} error={issues['fares.'+id+'.'+key]} onChange={value=>setSettings({...settings,fares:{...settings.fares,[id]:{...settings.fares[id],[key]:value}}})}/>;})}</div></details>)}<h3>Time-based pricing · Philippine time</h3><div className="owner-fields">{numberFields(['maxSurge','morningSurge','eveningSurge','nightSurge','fridayExtra'])}</div></fieldset>
 <fieldset hidden={section!==sections[2]} disabled={busy}><legend>Commission</legend><p>Commission is simulated; saving this does not move money.</p><div className="owner-fields">{numberFields(['commissionPercent'])}</div></fieldset>
 <fieldset hidden={section!==sections[3]} disabled={busy}><legend>Booking offers</legend><p>Every manual offer still requires the rider to accept.</p><div className="owner-fields">{numberFields(['offerSeconds','maxReassignments'])}</div></fieldset>
 {hasInvalidNumbers&&<p className="error-message" role="alert">Correct {Object.keys(issues).length} invalid setting(s) before reviewing: {Object.values(issues)[0]}</p>}
 <details className="card conversation"><summary>Preview a fare</summary><div className="owner-fields"><label>Vehicle<select className="input" value={vehicle} onChange={event=>setVehicle(event.target.value as typeof vehicle)}>{(['MOTORCYCLE','TRICYCLE','SEDAN'] as const).map(id=><option key={id} value={id}>{VEHICLES[id].label}</option>)}</select></label><label>Billable distance (km)<input className="input" type="number" min="0" step=".1" value={Number.isFinite(distance)?distance:''} onChange={event=>setDistance(event.target.valueAsNumber)}/></label><label>Cargo weight (kg; use 0 for a ride)<input className="input" type="number" min="0" value={Number.isFinite(weight)?weight:''} onChange={event=>setWeight(event.target.valueAsNumber)}/></label></div>{fare&&Number.isFinite(fare.totalFare)?<p>Currently saved: ₱{previousFare?.totalFare.toFixed(2)} → With your changes: <strong>₱{fare.totalFare.toFixed(2)}</strong> · Demo commission: ₱{(fare.totalFare*settings.commissionPercent/100).toFixed(2)} · Rider remainder: ₱{(fare.totalFare*(1-settings.commissionPercent/100)).toFixed(2)}</p>:<p className="error-message">Correct invalid settings and preview inputs to calculate a fare.</p>}</details>
 <label>Reason for change<textarea className="input" value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} required disabled={busy}/></label>
 {message&&<p role={failed?'alert':'status'} className={failed?'error-message':'success-message'}>{message}</p>}
 <div className="staff-actions"><button className="btn btn-primary" disabled={busy||hasInvalidNumbers||!dirty}>{busy?'Saving…':'Review changes'}</button><button type="button" className="btn" disabled={busy||!dirty} onClick={()=>{setDiscard({kind:'discard'});discardDialog.current?.showModal();}}>Discard changes</button></div>
 </form>
 <dialog ref={dialog} className="inbox-dialog" aria-labelledby={titleId} onCancel={event=>{if(pending.current)event.preventDefault();}}><h2 id={titleId}>Review platform changes</h2><p>Applies to future booking requests. Active jobs and saved valid checkout amounts keep their recorded values.</p><div className="table-card"><table><thead><tr><th>Setting</th><th>Currently saved</th><th>New value</th></tr></thead><tbody>{changes.map(change=><tr key={change.field}><td>{change.field}</td><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table></div><p><strong>Reason:</strong> {reason}</p>
 {failed&&message&&<p role="alert" className="error-message">{message}</p>}{conflict&&<button className="btn" onClick={()=>{setDiscard({kind:'reload'});discardDialog.current?.showModal();}}>Discard draft & load latest</button>}
 <div className="staff-actions"><button className="btn" autoFocus disabled={busy} onClick={()=>dialog.current?.close()}>Back to editing</button><button className="btn btn-primary" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Saving…':'Save '+changes.length+' change'+(changes.length===1?'':'s')}</button></div></dialog>
 <dialog ref={discardDialog} className="inbox-dialog" aria-labelledby={discardTitle}><h2 id={discardTitle}>Discard unsaved settings?</h2><p>{discard.kind==='leave'?'Leaving this page will discard your draft.':discard.kind==='reload'?'Load the latest saved settings and discard this draft?':'Return all fields to their currently saved values?'}</p><div className="staff-actions"><button className="btn" autoFocus onClick={()=>discardDialog.current?.close()}>Keep editing</button><button className="btn btn-danger" onClick={()=>{discardDialog.current?.close();if(discard.kind!=='discard'){leaving.current=true;if(discard.kind==='reload')window.location.reload();else if(discard.href)window.location.assign(discard.href);}else{setSettings(baseline);setReason('');setMessage('Unsaved changes discarded.');setFailed(false);}}}>{discard.kind==='leave'?'Discard & leave':discard.kind==='reload'?'Discard & load latest':'Discard changes'}</button></div></dialog>
 </>;
}
