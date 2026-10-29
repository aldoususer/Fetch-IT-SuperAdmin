import {NextResponse} from 'next/server';
import {ownerRoute,OwnerError} from '@/lib/owner-http';
import {db} from '@/lib/db';
import {hashPassword} from '@/lib/password';
import {isStaffRole,isManagedStaffRole} from '@/lib/staff-policy';
export const POST=ownerRoute(async(req,owner)=>{
  const body=await req.json();const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(!reason||reason.length>500)throw new OwnerError('Provide a reason of up to 500 characters.');
  const result=await db.$transaction(async tx=>{
    let id=String(body.id??'');let before:unknown=null;let after:unknown;
    if(body.action==='create'){
      if(!isStaffRole(body.role)||typeof body.name!=='string'||!body.name.trim()||body.name.length>100||typeof body.email!=='string'||!/^\S+@\S+\.\S+$/.test(body.email)||body.email.length>254||typeof body.password!=='string'||body.password.length<14||body.password.length>128)throw new OwnerError('Choose a staff role, valid name/email, and a unique password of 14–128 characters.');
      const email=body.email.trim().toLowerCase();if(await tx.user.findUnique({where:{email}}))throw new OwnerError('This email is already registered.');
      const user=await tx.user.create({data:{name:body.name.trim(),email,role:body.role,authIdentities:{create:{provider:'PASSWORD',providerUserId:email,passwordHash:hashPassword(body.password)}}}});id=user.id;after={role:user.role,email};
    }else{
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${id} FOR UPDATE`;
      const target=await tx.user.findUnique({where:{id}});if(!target||!isManagedStaffRole(target.role))throw new OwnerError('Staff account not found.',404);
      before={role:target.role,disabled:target.isBanned};
      if(body.action==='role'){
        if(!isStaffRole(body.role))throw new OwnerError('Choose a staff role.');await tx.user.update({where:{id},data:{role:body.role,authInvalidBefore:new Date()}});after={role:body.role};
      }else if(body.action==='disable'||body.action==='restore'){
        const disabled=body.action==='disable';await tx.user.update({where:{id},data:{isBanned:disabled,banReason:disabled?reason:null,bannedAt:disabled?new Date():null,authInvalidBefore:new Date()}});after={disabled};
      }else if(body.action==='revoke'){await tx.user.update({where:{id},data:{authInvalidBefore:new Date()}});after={sessionsRevoked:true};}
      else throw new OwnerError('Unknown staff action.');
      await tx.staffSession.updateMany({where:{userId:id,revokedAt:null},data:{revokedAt:new Date()}});
    }
    await tx.ownerAudit.create({data:{actorId:owner.id,actorName:owner.name,action:`STAFF_${body.action.toUpperCase()}`,entityId:id,details:{before:JSON.parse(JSON.stringify(before)),after:JSON.parse(JSON.stringify(after)),reason}}});return id;
  });return NextResponse.json({message:'Staff access saved. Existing sessions were revoked where applicable.',id:result});
});
