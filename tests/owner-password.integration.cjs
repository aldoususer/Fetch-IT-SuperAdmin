// Opt-in, verified test branch only. Creates and disables disposable owners; no DDL.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseEnv}=require('node:util'),{PrismaClient}=require('@prisma/client');
if(process.env.RUN_OWNER_PASSWORD_TEST!=='1')throw Error('Set RUN_OWNER_PASSWORD_TEST=1.');
const root=path.resolve(__dirname,'..'),env=parseEnv(fs.readFileSync(path.join(root,'.env.local'),'utf8')),u=new URL(env.DATABASE_URL);
if(u.hostname!=='ep-blue-shape-b307j74k.c-4.ap-southeast-1.aws.neon.tech'||u.username!=='fetch_owner_runtime')throw Error('Only the verified test branch is allowed.');
const db=new PrismaClient({datasourceUrl:env.DATABASE_URL}),ts=require('typescript'),Module=require('node:module');
const helper=new Module(path.join(root,'src/lib/owner-password.ts'),module);helper.filename=helper.id;helper.paths=module.paths;
helper._compile(ts.transpileModule(fs.readFileSync(helper.filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,helper.filename);
const {hashOwnerPassword,verifyOwnerPassword,validateOwnerPassword}=helper.exports;
const base='http://localhost:3443',origin='https://owner-password-test.example.invalid',id=crypto.randomUUID().slice(0,8),owners=[],checks=[];
const password=crypto.randomBytes(24).toString('base64url'),nextPassword=crypto.randomBytes(24).toString('base64url'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function request(route,status,body,jar={},extra={}){
const method=body===undefined?'GET':'POST',r=await fetch(base+route,{method,redirect:'manual',headers:{origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...extra,...(Object.keys(jar).length?{cookie:Object.entries(jar).map(([k,v])=>k+'='+v).join('; ')}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar[p.slice(0,i)]=p.slice(i+1);}const text=await r.text();assert.equal(r.status,status,method+' '+route+': '+text.slice(0,140));checks.push({method,route,status});return {r,data:r.headers.get('content-type')?.includes('application/json')?JSON.parse(text):text};}
async function owner(suffix,active=true){const email='qa-owner-password-'+id+'-'+suffix+'@example.invalid',actor=await db.user.create({data:{email,name:'QA Password '+id+' '+suffix,role:'SUPERADMIN'}}),o=await db.ownerIdentity.create({data:{email,name:actor.name,actorId:actor.id,active}});owners.push(o);return o;}
(async()=>{
assert(!validateOwnerPassword('a'.repeat(14)));assert(validateOwnerPassword('a'.repeat(15)));assert(!validateOwnerPassword('a'.repeat(129)));
const hash=await hashOwnerPassword(password);assert.notEqual(hash,await hashOwnerPassword(password));assert(await verifyOwnerPassword(password,hash));assert(!await verifyOwnerPassword('wrong',hash));assert(!await verifyOwnerPassword(password,null));
const active=await owner('active'),disabled=await owner('disabled',false);
await db.ownerIdentity.update({where:{id:disabled.id},data:{passwordHash:hash,passwordChangedAt:new Date()}});
const token=crypto.randomBytes(32).toString('base64url');await db.ownerInvitation.create({data:{id:sha(token),ownerId:active.id,expiresAt:new Date(Date.now()+30*60_000)}});
const cookies={},setup={action:'setup',email:active.email,password,token};
await request('/api/auth/login',403,{email:active.email,password},{},{origin:'https://foreign.example'});
await request('/api/owner-auth',400,{action:'enroll-options'});
await request('/api/auth/login',401,{email:active.email,password});
await request('/api/owner-auth',403,{...setup,token:'A'.repeat(43)});
await request('/api/owner-auth',400,{...setup,password:'short'});
await request('/api/owner-auth',403,{...setup,email:'wrong@example.invalid'});
await request('/api/owner-auth',200,setup,cookies);
const saved=await db.ownerIdentity.findUniqueOrThrow({where:{id:active.id}});assert(await verifyOwnerPassword(password,saved.passwordHash));assert.notEqual(saved.passwordHash,password);assert((await db.ownerInvitation.findUniqueOrThrow({where:{id:sha(token)}})).usedAt);
await request('/api/owner-auth',403,setup);
assert(cookies['__Host-fetch_owner']);
const sid=sha(cookies['__Host-fetch_owner']);
await request('/dashboard/security',200,undefined,cookies);
await request('/api/settings',401,{}, {fetch_staff:'unrelated-staff-cookie'});
await db.ownerSession.update({where:{id:sid},data:{verifiedAt:new Date(Date.now()-6*60_000)}});
await request('/api/settings',401,{},cookies);
await request('/api/owner-auth',401,{action:'confirm',password:'wrong'},cookies);
await request('/api/owner-auth',200,{action:'confirm',password},cookies);
await request('/api/settings',400,{},cookies);
await request('/api/auth/login',401,{email:'support-test@example.invalid',password});
await request('/api/auth/login',401,{email:disabled.email,password});
await request('/api/auth/login',401,{email:active.email,password:'wrong'});
const signedIn={},login=await request('/api/auth/login',200,{email:active.email.toUpperCase(),password},signedIn);
const c=login.r.headers.getSetCookie().find(x=>x.startsWith('__Host-fetch_owner='));assert.match(c,/Secure/i);assert.match(c,/HttpOnly/i);assert.match(c,/SameSite=strict/i);assert(!/Domain=/i.test(c));
await request('/api/owner-auth',200,{action:'change-password',password,newPassword:nextPassword},signedIn);
assert((await db.ownerSession.findUniqueOrThrow({where:{id:sid}})).revokedAt);
await request('/api/settings',401,{},cookies);await request('/api/auth/login',401,{email:active.email,password});
const last={};await request('/api/auth/login',200,{email:active.email,password:nextPassword},last);await request('/api/auth/logout',200,{},last);await request('/dashboard',307,undefined,last);
const blocked=await owner('limited');await db.ownerIdentity.update({where:{id:blocked.id},data:{passwordHash:hash,passwordChangedAt:new Date()}});
for(let i=0;i<10;i++)await request('/api/auth/login',401,{email:blocked.email,password:'wrong'});
const limited=await request('/api/auth/login',429,{email:blocked.email,password});assert(Number(limited.r.headers.get('retry-after'))>0);
const access=await db.$queryRawUnsafe("SELECT has_column_privilege('fetch_staff_runtime','\"OwnerIdentity\"','passwordHash','SELECT') AS read,has_column_privilege('fetch_staff_runtime','\"OwnerIdentity\"','passwordHash','UPDATE') AS write");assert.equal(access[0].read,false);assert.equal(access[0].write,false);
fs.writeFileSync('C:/Users/Z/AppData/Local/FetchSetup/owner-password-browser.private.json',JSON.stringify({email:active.email,password:nextPassword,ownerId:active.id,runId:id}));
console.log(JSON.stringify({result:'PASS',runId:id,httpChecks:checks.length,passwordHashTests:7,staffCannotAccessOwnerPassword:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
for(const o of owners){await db.ownerIdentity.update({where:{id:o.id},data:{active:false}});await db.ownerSession.updateMany({where:{ownerId:o.id,revokedAt:null},data:{revokedAt:new Date()}});await db.ownerInvitation.updateMany({where:{ownerId:o.id,usedAt:null},data:{usedAt:new Date()}});}
fs.writeFileSync('C:/Users/Z/AppData/Local/FetchSetup/owner-password-test-results.json',JSON.stringify({runId:id,checks,fixturesDisabled:owners.length,passed:!process.exitCode,completedAt:new Date().toISOString()},null,2));await db.$disconnect();
});
