// Run locally with separately authorized maintenance credentials. Never expose as an API.
const {PrismaClient}=require('@prisma/client');
const {randomBytes,createHash}=require('node:crypto');
try{process.loadEnvFile();}catch{}
const [mode,emailInput,nameInput]=process.argv.slice(2);
if(!['create','recover'].includes(mode)||!/^\S+@\S+\.\S+$/.test(emailInput||'')||!process.env.OWNER_MAINTENANCE_DATABASE_URL)throw new Error('Usage: npm run bootstrap-owner -- create|recover owner@example.com "Owner Name". Configure OWNER_MAINTENANCE_DATABASE_URL locally.');
const db=new PrismaClient({datasourceUrl:process.env.OWNER_MAINTENANCE_DATABASE_URL});
(async()=>{const email=emailInput.trim().toLowerCase(),token=randomBytes(32).toString('base64url');
  await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fetch-owner-administration'))`;
    let owner=await tx.ownerIdentity.findUnique({where:{email}});
    if(mode==='create'){
      if(await tx.ownerIdentity.count())throw new Error('Bootstrap creation is only for the first owner. Invite subsequent owners from the console.');
      if(!nameInput?.trim()||await tx.user.findUnique({where:{email}}))throw new Error('Provide a name and a new, separate owner email.');
      const actor=await tx.user.create({data:{email,name:nameInput.trim(),role:'SUPERADMIN'}});
      owner=await tx.ownerIdentity.create({data:{actorId:actor.id,name:actor.name,email}});
    }
    if(!owner?.active)throw new Error('An active approved owner is required.');
    await tx.ownerInvitation.updateMany({where:{ownerId:owner.id,usedAt:null},data:{usedAt:new Date()}});
    await tx.ownerSession.updateMany({where:{ownerId:owner.id,revokedAt:null},data:{revokedAt:new Date()}});
    await tx.ownerInvitation.create({data:{id:createHash('sha256').update(token).digest('hex'),ownerId:owner.id,expiresAt:new Date(Date.now()+30*60_000)}});
    await tx.ownerAudit.create({data:{actorId:owner.id,actorName:owner.name,action:mode==='create'?'OWNER_BOOTSTRAPPED':'OWNER_RECOVERY_ISSUED',entityId:owner.id,details:{method:'Authorized local maintenance',existingKeysPreserved:true}}});
  });
  console.log('One-time enrollment token (expires in 30 minutes). Enter it on /enroll; do not paste it into chat or commit it:');console.log(token);
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.$disconnect());
