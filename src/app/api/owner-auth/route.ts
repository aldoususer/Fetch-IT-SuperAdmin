import {NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {randomBytes} from 'node:crypto';
import {generateAuthenticationOptions,verifyAuthenticationResponse,generateRegistrationOptions,verifyRegistrationResponse,type AuthenticationResponseJSON,type RegistrationResponseJSON} from '@simplewebauthn/server';
import {db} from '@/lib/db';
import {currentOwner,ownerConfig,issueOwnerSession,digest} from '@/lib/owner-auth';
import {OwnerError} from '@/lib/owner-http';
import {assertRuntimeAccess} from '@/lib/runtime-access';
import {limitRequests,clientAddress,RateLimitError} from '@/lib/request-guard';
export async function POST(req:NextRequest){
  try{
    const config=ownerConfig();if(req.headers.get('origin')!==config.origin)throw new OwnerError('This request is not allowed.',403);
    await assertRuntimeAccess('owner');
    await limitRequests('owner:passkey',clientAddress(req),40,15*60_000);
    const body=await req.json();const store=await cookies();
    if(body.action==='options'||body.action==='enroll-options'){
      const owner=await currentOwner(body.action==='enroll-options');
      let ownerId:string|undefined,invitationId:string|undefined;
      if(body.action==='enroll-options'){
        if(owner){ownerId=owner.id;}
        else {
          if(typeof body.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.token))throw new OwnerError('An approved enrollment token is required.',403);
          const invite=await db.ownerInvitation.findFirst({where:{id:digest(body.token),usedAt:null,expiresAt:{gt:new Date()},owner:{active:true}}});
          if(!invite)throw new OwnerError('The enrollment token is invalid or expired.',403);
          ownerId=invite.ownerId;invitationId=invite.id;
        }
      }
      const identity=ownerId?await db.ownerIdentity.findUniqueOrThrow({where:{id:ownerId},include:{credentials:true}}):null;
      const options=identity?await generateRegistrationOptions({rpName:'Fetch Superadmin',rpID:config.rpID,userID:new TextEncoder().encode(identity.id),userName:identity.email,userDisplayName:identity.name,attestationType:'none',authenticatorSelection:{residentKey:'required',userVerification:'required'},excludeCredentials:identity.credentials.map(c=>({id:c.id}))}):await generateAuthenticationOptions({rpID:config.rpID,userVerification:'required'});
      const token=randomBytes(32).toString('base64url');
      await db.ownerChallenge.create({data:{id:digest(token),purpose:identity?'REGISTER':'LOGIN',challenge:options.challenge,ownerId,invitationId,sessionId:owner?.sessionId,expiresAt:new Date(Date.now()+3*60_000)}});
      store.set(config.challengeCookie,token,{httpOnly:true,secure:config.secure,sameSite:'strict',path:'/',maxAge:180});
      return NextResponse.json({options},{headers:{'Cache-Control':'private, no-store'}});
    }
    if(!['verify','enroll-verify'].includes(body.action))throw new OwnerError('Unknown authentication action.');
    const raw=store.get(config.challengeCookie)?.value;if(!raw)throw new OwnerError('Start sign-in again.',401);
    const challengeId=digest(raw);
    let retainedSession=false;
    const ownerId=await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "OwnerChallenge" WHERE "id"=${challengeId} FOR UPDATE`;
      const challenge=await tx.ownerChallenge.findUnique({where:{id:challengeId}});
      if(!challenge||challenge.expiresAt<=new Date())throw new OwnerError('Authentication expired. Start again.',401);
      if(body.action==='enroll-verify'){
        if(challenge.purpose!=='REGISTER'||!challenge.ownerId)throw new OwnerError('Start enrollment again.',401);
        await tx.$queryRaw`SELECT "id" FROM "OwnerIdentity" WHERE "id"=${challenge.ownerId} FOR UPDATE`;
        const identity=await tx.ownerIdentity.findUnique({where:{id:challenge.ownerId}});if(!identity?.active)throw new OwnerError('Account unavailable.',403);
        if(challenge.invitationId){const used=await tx.ownerInvitation.updateMany({where:{id:challenge.invitationId,ownerId:identity.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}});if(!used.count)throw new OwnerError('Enrollment token expired or already used.',401);}
        else {const owner=await currentOwner(true);if(!owner||owner.id!==identity.id||owner.sessionId!==challenge.sessionId)throw new OwnerError('Authenticate again before adding a key.',401);retainedSession=true;}
        const result=await verifyRegistrationResponse({response:body.response as RegistrationResponseJSON,expectedChallenge:challenge.challenge,expectedOrigin:config.origin,expectedRPID:config.rpID,requireUserVerification:true});
        if(!result.verified||!result.registrationInfo)throw new OwnerError('Passkey verification failed.',401);
        const c=result.registrationInfo.credential;
        await tx.ownerCredential.create({data:{id:c.id,ownerId:identity.id,label:typeof body.label==='string'?body.label.trim().slice(0,80)||'Passkey':'Passkey',publicKey:Buffer.from(c.publicKey),counter:BigInt(c.counter),transports:c.transports??[]}});
        await tx.ownerAudit.create({data:{actorId:identity.id,actorName:identity.name,action:'PASSKEY_ADDED',entityId:identity.id,details:{method:challenge.invitationId?'Approved enrollment':'Existing verified session'}}});
        await tx.ownerChallenge.delete({where:{id:challengeId}});return identity.id;
      }
      if(challenge.purpose!=='LOGIN')throw new OwnerError('Start sign-in again.',401);
      const response=body.response as AuthenticationResponseJSON;
      if(typeof response?.id!=='string')throw new OwnerError('Passkey verification failed.',401);
      await tx.$queryRaw`SELECT "id" FROM "OwnerCredential" WHERE "id"=${response.id} FOR UPDATE`;
      const credential=await tx.ownerCredential.findUnique({where:{id:response.id},include:{owner:true}});
      if(!credential?.owner.active)throw new OwnerError('Passkey verification failed.',401);
      if(challenge.sessionId){const owner=await currentOwner();if(!owner||owner.id!==credential.ownerId||owner.sessionId!==challenge.sessionId)throw new OwnerError('Use the passkey for this account.',401);}
      const result=await verifyAuthenticationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:config.origin,expectedRPID:config.rpID,credential:{id:credential.id,publicKey:new Uint8Array(credential.publicKey),counter:Number(credential.counter)},requireUserVerification:true});
      if(!result.verified)throw new OwnerError('Passkey verification failed.',401);
      await tx.ownerCredential.update({where:{id:credential.id},data:{counter:BigInt(result.authenticationInfo.newCounter)}});
      await tx.ownerChallenge.delete({where:{id:challengeId}});
      if(challenge.sessionId){await tx.ownerSession.update({where:{id:challenge.sessionId},data:{verifiedAt:new Date()}});retainedSession=true;}
      await tx.ownerAudit.create({data:{actorId:credential.ownerId,actorName:credential.owner.name,action:'PASSKEY_SIGN_IN',entityId:credential.ownerId,details:{userVerified:true}}});
      return credential.ownerId;
    },{timeout:20000});
    store.delete(config.challengeCookie);
    if(!retainedSession)await issueOwnerSession(ownerId);
    return NextResponse.json({ok:true,redirect:'/dashboard'},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof OwnerError?error.message:error instanceof RateLimitError?error.message:'Passkey sign-in could not be completed. Check your key and account configuration.'},{status:error instanceof OwnerError?error.status:error instanceof RateLimitError?429:400,headers:{'Cache-Control':'private, no-store'}});}
}
