import {NextRequest,NextResponse} from 'next/server';
import {currentOwner,ownerConfig} from './owner-auth';
export class OwnerError extends Error{constructor(message:string,public status=400){super(message);}}
export function ownerRoute(handler:(req:NextRequest,owner:NonNullable<Awaited<ReturnType<typeof currentOwner>>>)=>Promise<Response>,fresh=true){
  return async(req:NextRequest)=>{try{
    const config=ownerConfig();if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==config.origin)throw new OwnerError('This request is not allowed.',403);
    const owner=await currentOwner(fresh&&!['GET','HEAD'].includes(req.method));if(!owner)throw new OwnerError('Confirm your password in Security & sessions before continuing.',401);
    const response=await handler(req,owner);response.headers.set('Cache-Control','private, no-store');return response;
  }catch(error){return NextResponse.json({error:error instanceof OwnerError?error.message:'The owner service is unavailable. Check configuration and try again.'},{status:error instanceof OwnerError?error.status:503,headers:{'Cache-Control':'private, no-store'}});}};
}
