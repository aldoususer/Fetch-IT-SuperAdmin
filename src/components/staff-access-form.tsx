"use client";
import {useState} from 'react';
import {ActionForm} from './action-form';
import {ROLE_LABELS,STAFF_ROLES} from '@/lib/staff-policy';
const summaries:Record<string,string>={
 ADMIN:'Oversees daily operations, staff work, and cases that require an independent operational decision.',
 SUPPORT:'Replies to customer requests and asks a supervisor or Safety Review for help.',
 SUPPORT_SUPERVISOR:'Handles escalated support requests, guides support staff, and manages support resources.',
 SAFETY:'Reviews safety incidents and rider applications, records evidence, and recommends action.',
};
export function StaffAccessForm({person}:{person?:{id:string;name:string;role:string;isBanned:boolean}}){
 const [role,setRole]=useState(person?.role==='FINANCE'?'':person?.role??'');
 return <section><h2>{person?'Change role':'Account details'}</h2><p>{person?'Changing a role signs this person out on all devices. Their account remains active unless you disable it.':'Choose the access this person needs. No role is selected automatically.'}</p>
 <ActionForm url="/api/staff" hidden={person?{action:'role',id:person.id}:{action:'create'}} confirm label={person?'Save role change':'Create staff account'}
 confirmation={person?'Change permissions for '+person.name+' and sign them out on all devices?':'Create a new staff account with the selected permissions?'}
 fields={[
 ...(!person?[{name:'name',label:'Full name',required:true,autoComplete:'section-newstaff name'},{name:'email',label:'Staff work email',type:'email',required:true,autoComplete:'section-newstaff username'}]:[]),
 {name:'role',label:'Role',value:role,required:true,onChange:setRole,help:summaries[role]??'Choose a role to see what this person can do.',options:[{value:'',label:'Choose a role'},...STAFF_ROLES.map(value=>({value,label:ROLE_LABELS[value]}))]},
 ...(!person?[{name:'password',label:'Initial password (14–128 characters)',type:'password',required:true,minLength:14,autoComplete:'new-password',help:'Use a unique password for this staff member.'}]:[]),
 {name:'reason',label:person?'Reason for role change':'Reason for granting access',type:'textarea',required:true},
 ]}/>
 {person&&<><h2>Sign-in access</h2><p>Sign out on all devices if a device is lost or a session should end. This does not disable the account.</p>
 <ActionForm url="/api/staff" hidden={{action:'revoke',id:person.id}} label="Sign out on all devices" confirm confirmation={'End all current sign-in sessions for '+person.name+'? They can sign in again.'} fields={[{name:'reason',label:'Reason for signing out',required:true}]}/>
 <section className="danger-zone"><h2>{person.isBanned?'Restore account':'Disable account'}</h2><p>{person.isBanned?'Allow this person to sign in again with their assigned role.':'Block new sign-ins and end current sessions. Their assigned work and history will be retained.'}</p>
 <ActionForm url="/api/staff" hidden={{action:person.isBanned?'restore':'disable',id:person.id}} label={person.isBanned?'Restore account':'Disable account'} confirm confirmation={(person.isBanned?'Restore access for ':'Block sign-in and end all sessions for ')+person.name+'?'} fields={[{name:'reason',label:'Reason',required:true}]}/></section></>}
 </section>;
}
