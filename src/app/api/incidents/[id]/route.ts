import {NextRequest,NextResponse} from 'next/server';
import {ownerRoute,OwnerError} from '@/lib/owner-http';
import {db} from '@/lib/db';
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return ownerRoute(async(request,owner)=>{
  const body=await request.json();
  if(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>500)throw new OwnerError('Add a recovery explanation of 1–500 characters.');
  await db.$transaction(async tx=>{
   const saved=await tx.platformIncident.updateMany({where:{id,revision:body.revision,active:true},data:{active:false,resolvedAt:new Date(),revision:{increment:1},detail:body.reason.trim()}});
   if(!saved.count)throw new OwnerError('This incident changed. Refresh before recording recovery.',409);
   await tx.ownerAudit.create({data:{actorId:owner.id,actorName:owner.name,action:'PLATFORM_INCIDENT_RECOVERED',entityId:id,details:{reason:body.reason.trim()}}});
  });
  return NextResponse.json({message:'Recovery recorded. Staff received the recovery update.'});
 })(req);
}
