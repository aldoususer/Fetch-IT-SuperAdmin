import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {ownerRoute,OwnerError} from '@/lib/owner-http';
import {db} from '@/lib/db';
export const POST=ownerRoute(async(req,owner)=>{
 const body=await req.json();
 const text=(value:unknown,max:number)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new OwnerError('Complete the incident fields within the displayed limits.');return value.trim();};
 if(!['INFRASTRUCTURE','REGULATORY','SAFETY_PATTERN','SUPPLY_DISRUPTION'].includes(body.category))throw new OwnerError('Choose an incident category.');
 if(!['HIGH','CRITICAL'].includes(body.severity))throw new OwnerError('Choose High or Critical.');
 const id=`reported:${randomUUID()}`;
 await db.$transaction(async tx=>{
  await tx.platformIncident.create({data:{id,category:body.category,scope:text(body.scope,120),title:text(body.title,160),detail:text(body.detail,500),severity:body.severity,platformWide:true}});
  await tx.ownerAudit.create({data:{actorId:owner.id,actorName:owner.name,action:'PLATFORM_INCIDENT_REPORTED',entityId:id,details:{reason:text(body.reason,500)}}});
 });
 return NextResponse.json({message:'Incident published. Staff received the operational advisory.'},{status:201});
});
