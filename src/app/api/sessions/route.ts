import {NextResponse} from 'next/server';
import {ownerRoute,OwnerError} from '@/lib/owner-http';
import {db} from '@/lib/db';
export const POST=ownerRoute(async(req,owner)=>{const body=await req.json();if(typeof body.id!=='string')throw new OwnerError('Choose a session.');await db.$transaction(async tx=>{const result=await tx.ownerSession.updateMany({where:{id:body.id,ownerId:owner.id},data:{revokedAt:new Date()}});if(!result.count)throw new OwnerError('Session unavailable.',404);await tx.ownerAudit.create({data:{actorId:owner.id,actorName:owner.name,action:'OWNER_REVOKE_SESSION',entityId:body.id,details:{ownSession:true}}});});return NextResponse.json({message:'Session revoked.'});});
