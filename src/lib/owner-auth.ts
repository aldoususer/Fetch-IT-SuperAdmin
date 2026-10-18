import 'server-only';
import {createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {db} from './db';
import {assertRuntimeAccess} from './runtime-access';
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function ownerConfig(){
  const origin=process.env.SUPERADMIN_URL||(process.env.NODE_ENV!=='production'?'http://localhost:3003':'');
  if(!origin)throw new Error('Configure SUPERADMIN_URL.');const url=new URL(origin);
  if(url.origin!==origin || url.pathname!=='/' || (url.protocol!=='https:'&&!(url.hostname==='localhost'&&process.env.NODE_ENV!=='production')))throw new Error('SUPERADMIN_URL must be an exact secure origin.');
  return {origin,secure:url.protocol==='https:',cookie:url.protocol==='https:'?'__Host-fetch_owner':'fetch_owner'};
}
export async function currentOwner(fresh=false){
  const config=ownerConfig();const raw=(await cookies()).get(config.cookie)?.value;if(!raw||!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
  await assertRuntimeAccess('owner');
  const id=digest(raw);const now=new Date();
  // Atomic conditional touch prevents a concurrent revocation from reviving a session.
  const touched=await db.ownerSession.updateMany({where:{id,revokedAt:null,expiresAt:{gt:now},lastSeenAt:{gt:new Date(now.getTime()-15*60_000)},owner:{active:true,passwordHash:{not:null},actor:{role:'SUPERADMIN',isBanned:false}},...(fresh?{verifiedAt:{gt:new Date(now.getTime()-5*60_000)}}:{})},data:{lastSeenAt:now}});
  if(!touched.count)return null;
  const session=await db.ownerSession.findFirst({where:{id,revokedAt:null,owner:{active:true,passwordHash:{not:null},actor:{role:'SUPERADMIN',isBanned:false}}},select:{verifiedAt:true,owner:{select:{id:true,actorId:true,name:true,email:true,active:true}}}});
  return session?{...session.owner,sessionId:id,verifiedAt:session.verifiedAt}:null;
}
export async function ownerAudit(actor:{id:string;name:string},action:string,entityId:string,details:object){
  return db.ownerAudit.create({data:{actorId:actor.id,actorName:actor.name,action,entityId,details:JSON.parse(JSON.stringify(details))}});
}
