import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {ownerRoute,OwnerError} from '@/lib/owner-http';
import {digest} from '@/lib/owner-auth';
import {db} from '@/lib/db';
export const POST=ownerRoute(async(req,owner)=>{
  const body=await req.json();const token=randomBytes(32).toString('base64url');
  const result=await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fetch-owner-administration'))`;
    let id=String(body.id??'');let details:object;let invitation=false;
    if(body.action==='invite'){
      if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100||typeof body.email!=='string'||!/^\S+@\S+\.\S+$/.test(body.email)||body.email.length>254)throw new OwnerError('Enter a valid name and email.');
      const email=body.email.trim().toLowerCase();
      if(await tx.user.findUnique({where:{email}}))throw new OwnerError('Use a separate Superadmin email that is not already registered.');
      const actor=await tx.user.create({data:{email,name:body.name.trim(),role:'SUPERADMIN'}});
      const identity=await tx.ownerIdentity.create({data:{actorId:actor.id,name:actor.name,email}});id=identity.id;
      await tx.ownerInvitation.create({data:{id:digest(token),ownerId:id,expiresAt:new Date(Date.now()+30*60_000)}});invitation=true;details={email};
    }else if(body.action==='disable'||body.action==='activate'){
      const target=await tx.ownerIdentity.findUnique({where:{id}});if(!target)throw new OwnerError('Superadmin account not found.',404);
      if(body.action==='disable'&&target.active&&target.passwordHash){const active=await tx.ownerIdentity.count({where:{active:true,passwordHash:{not:null}}});if(active<=1)throw new OwnerError('The last active Superadmin cannot be disabled. Keep at least one active Superadmin.',409);}
      await tx.ownerIdentity.update({where:{id},data:{active:body.action==='activate'}});
      await tx.ownerSession.updateMany({where:{ownerId:id,revokedAt:null},data:{revokedAt:new Date()}});details={active:body.action==='activate'};
    }else if(body.action==='revoke-session'){
      const target=await tx.ownerSession.findUnique({where:{id}});if(!target)throw new OwnerError('Session unavailable.',404);
      await tx.ownerSession.update({where:{id},data:{revokedAt:new Date()}});details={ownerId:target.ownerId};
    }else throw new OwnerError('Unsupported Superadmin account action.');
    await tx.ownerAudit.create({data:{actorId:owner.id,actorName:owner.name,action:`OWNER_${body.action.toUpperCase()}`,entityId:id,details:JSON.parse(JSON.stringify(details))}});
    return {invitation};
  });
  return NextResponse.json({message:result.invitation?`One-time password setup code (expires in 30 minutes): ${token}`:body.action==='revoke-session'?'Session signed out.':body.action==='disable'?'Superadmin account disabled. All sessions have ended.':'Superadmin access restored.'});
});
