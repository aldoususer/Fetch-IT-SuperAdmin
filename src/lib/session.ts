import {cookies} from 'next/headers';
import {currentOwner,ownerConfig,digest} from './owner-auth';
import {db} from './db';
export async function getAdminSession(){const owner=await currentOwner();return owner?{uid:owner.actorId,name:owner.name,email:owner.email,sid:owner.sessionId,iat:owner.verifiedAt.getTime(),exp:Date.now()+60000}:null;}
export async function clearAdminSessionCookie(){const config=ownerConfig();const store=await cookies();const raw=store.get(config.cookie)?.value;if(raw)await db.ownerSession.updateMany({where:{id:digest(raw)},data:{revokedAt:new Date()}});store.delete(config.cookie);}
