import {NextResponse} from 'next/server';
import {ownerRoute,OwnerError} from '@/lib/owner-http';
import {db} from '@/lib/db';
import {validateSettingsUpdate} from '@/lib/settings-limits';
export const POST=ownerRoute(async(req,owner)=>{
  const body=await req.json();let settings;try{settings=validateSettingsUpdate(body.settings);}catch(error){throw new OwnerError(error instanceof Error?error.message:'Invalid settings.');}
  const reason=typeof body.reason==='string'?body.reason.trim():'';if(!reason||reason.length>500)throw new OwnerError('Provide a change reason of up to 500 characters.');
  await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fetch-platform-settings'))`;
    const previous=await tx.platformConfig.findUnique({where:{id:'platform'}});
    if(body.version!==(previous?.version??0))throw new OwnerError('Another owner changed these settings. Refresh before saving.',409);
    const json=JSON.parse(JSON.stringify(settings));
    await tx.platformConfig.upsert({where:{id:'platform'},create:{id:'platform',settings:json},update:{settings:json,version:{increment:1}}});
    await tx.ownerAudit.create({data:{actorId:owner.id,actorName:owner.name,action:'PLATFORM_SETTINGS_CHANGED',entityId:'platform',details:{before:previous?.settings??null,after:json,reason,version:(previous?.version??0)+1}}});
  });return NextResponse.json({message:'Settings saved. Existing bookings and saved valid checkout amounts are preserved.'});
});
