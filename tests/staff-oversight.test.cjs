const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {NextRequest}=require('next/server');
const root=path.resolve(__dirname,'..');
const origin='https://oversight.example.invalid';

function load(file,overrides=new Map(),cache=new Map()) {
  let filename=path.resolve(root,file);
  if(!fs.existsSync(filename)&&filename.endsWith('.ts')&&fs.existsSync(filename+'x'))filename+='x';
  if(overrides.has(filename))return overrides.get(filename);
  if(cache.has(filename))return cache.get(filename);
  const exports={};cache.set(filename,exports);
  const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(compiled,{exports,process,Buffer,URL,URLSearchParams,console:{info(){},warn(){},error(){}},require(name){
    if(overrides.has(name))return overrides.get(name);
    if(name==='server-only')return {};
    if(name.startsWith('@/'))return load(name.replace('@/','src/')+'.ts',overrides,cache);
    if(name.startsWith('.'))return load(path.resolve(path.dirname(filename),name+'.ts'),overrides,cache);
    return require(name);
  }},{filename});
  return exports;
}
const policy=load('src/lib/staff-policy.ts');
const permissions=['operations','support','support.manage','finance','safety','resources.edit'];
for(const permission of permissions)test(`Superadmin explicitly receives ${permission}`,()=>assert.equal(policy.hasPermission('SUPERADMIN',permission),true));
test('Unknown permissions and unrecognized roles are denied',()=>{
  for(const role of ['SUPERADMIN','ADMIN','CUSTOMER','RIDER','unknown'])assert.equal(policy.hasPermission(role,'future.permission'),false);
  assert.equal(policy.hasPermission('unknown','operations'),false);
});
test('Lower staff roles retain their task boundaries',()=>{
  for(const [role,allowed]of Object.entries({SUPPORT:['support'],FINANCE:['finance'],SAFETY:['safety'],SUPPORT_SUPERVISOR:['support','support.manage','resources.edit'],ADMIN:permissions})) {
    for(const permission of permissions)assert.equal(policy.hasPermission(role,permission),allowed.includes(permission),`${role}: ${permission}`);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(policy.supportScope({id:'support',role:'SUPERADMIN'}))),{});
  assert.deepEqual(JSON.parse(JSON.stringify(policy.caseScope({id:'owner',role:'SUPERADMIN'}))),{});
  assert.notDeepEqual(JSON.parse(JSON.stringify(policy.supportScope({id:'support',role:'SUPPORT'}))),{});
});

function fixture({signedIn=true,fresh=true}={}) {
  const audits=[],messages=[],notes=[],freshChecks=[];
  const record={id:'case',kind:'SAFETY',status:'AWAITING_ADMIN',priority:'HIGH',assignedToId:'reviewer',createdById:'other-admin',recommendation:'Review the restriction',decision:null,decidedById:null,version:1};
  const ticket={id:'ticket',status:'RESOLVED',priority:'NORMAL',assignedAdminId:'support-a',lastCustomerMessageAt:new Date('2026-10-01'),lastAdminReplyAt:new Date('2026-10-02'),updatedAt:new Date('2026-10-03'),messages:[]};
  const db={
    async $queryRaw(){return [];},
    async $transaction(fn){return fn(db);},
    workflowCase:{async findFirst(){return {...record};},async update({data}){for(const [key,value]of Object.entries(data))record[key]=key==='version'?record.version+value.increment:value;return {...record};}},
    workflowNote:{async create({data}){notes.push(data);return {id:'note',...data};}},
    user:{async findFirst(){return {id:'reviewer-b',role:'SAFETY',isBanned:false};},async findUnique(){return {role:'SUPPORT',isBanned:false};}},
    supportTicket:{async findFirst(){return {...ticket};},async findUnique(){return {...ticket};},async updateMany({where,data}){if(where.updatedAt!==ticket.updatedAt)return {count:0};Object.assign(ticket,data);return {count:1};},async update({data}){Object.assign(ticket,data);return {...ticket};}},
    supportMessage:{async create({data}){messages.push(data);return {id:'message',...data};}},
    adminAudit:{async create({data}){audits.push(data);return data;}},
  };
  const overrides=new Map([
    [path.join(root,'src/lib/db.ts'),{db}],
    [path.join(root,'src/lib/owner-auth.ts'),{ownerConfig:()=>({origin}),currentOwner:async needsFresh=>{freshChecks.push(needsFresh);return signedIn&&(!needsFresh||fresh)?{id:'identity',actorId:'owner-actor',name:'QA Superadmin',email:'qa@example.invalid'}:null;}}],
    [path.join(root,'src/lib/push-delivery.ts'),{schedulePushDelivery(){}}],
    [path.join(root,'src/lib/customer-notifications.ts'),{async enqueueSupportNotification(){}}],
  ]);
  return {record,ticket,audits,messages,notes,db,overrides,freshChecks,
    async request(kind,body,requestOrigin=origin) {
      const id=kind==='cases'?'case':'ticket';
      const route=load(`src/app/api/${kind}/[id]/route.ts`,overrides);
      return route.PATCH(new NextRequest(`${origin}/api/${kind}/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json',...(requestOrigin?{origin:requestOrigin}:{})},body:JSON.stringify(body)}),{params:Promise.resolve({id})});
    }
  };
}
const supportBody={status:'OPEN',priority:'HIGH',assignedAdminId:'support-b',reply:'',updatedAt:'2026-10-03T00:00:00.000Z',reason:'Reopen and send to the correct reviewer'};
const caseBody={action:'assign',version:1,assignedToId:'reviewer-b',reason:'Independent safety review required'};
for(const kind of ['support','cases']) {
  const body=kind==='support'?supportBody:caseBody;
  for(const [name,options,requestOrigin,expected]of [
    ['guest',{signedIn:false},origin,401],['stale password',{fresh:false},origin,401],['foreign origin',{},'https://other.invalid',kind==='support'?401:403],['missing origin',{},null,kind==='support'?401:403]
  ])test(`${kind}: ${name} cannot intervene`,async()=>{
    const f=fixture(options);const before=JSON.stringify([f.record,f.ticket]);
    const response=await f.request(kind,body,requestOrigin);
    assert.equal(response.status,expected);assert.equal(JSON.stringify([f.record,f.ticket]),before);assert.equal(f.audits.length,0);
  });
  for(const reason of [undefined,'','  ','x'.repeat(501),42])test(`${kind}: invalid intervention reason ${String(reason).slice(0,12)} is rejected`,async()=>{
    const f=fixture();const response=await f.request(kind,{...body,reason});assert.equal(response.status,400);assert.equal(f.audits.length,0);
  });
}
test('Superadmin can reopen and reassign a resolved support request with an attributable change history',async()=>{
  const f=fixture();const response=await f.request('support',supportBody);assert.equal(response.status,200);
  assert.equal(f.ticket.status,'OPEN');assert.equal(f.ticket.assignedAdminId,'support-b');
  const audit=f.audits[0];assert.equal(audit.actorId,'owner-actor');assert.equal(audit.details.actorRole,'SUPERADMIN');assert.equal(audit.details.reason,supportBody.reason);
  assert.equal(audit.details.before.status,'RESOLVED');assert.equal(audit.details.before.assignedAdminId,'support-a');assert.equal(audit.details.after.status,'OPEN');assert.equal(audit.details.after.assignedAdminId,'support-b');assert(f.freshChecks.includes(true));
});
test('Support replies retain the Superadmin identity',async()=>{
  const f=fixture();assert.equal((await f.request('support',{...supportBody,reply:'We are reviewing your issue.'})).status,200);
  assert.equal(f.messages[0].authorId,'owner-actor');assert.equal(f.messages[0].authorRole,'SUPERADMIN');
});
test('An outdated support edit cannot overwrite newer work',async()=>{
  const f=fixture();assert.equal((await f.request('support',{...supportBody,updatedAt:'outdated'})).status,409);assert.equal(f.audits.length,0);
});
test('Superadmin can reassign another reviewer’s case with before/after history',async()=>{
  const f=fixture();assert.equal((await f.request('cases',caseBody)).status,200);assert.equal(f.record.assignedToId,'reviewer-b');
  const audit=f.audits[0];assert.equal(audit.actorId,'owner-actor');assert.equal(audit.details.reason,caseBody.reason);assert.equal(audit.details.actorRole,'SUPERADMIN');assert.equal(audit.details.before.assignedToId,'reviewer');assert.equal(audit.details.after.assignedToId,'reviewer-b');
});
test('Superadmin can make an independent decision on another reviewer’s recommendation',async()=>{
  const f=fixture();assert.equal((await f.request('cases',{action:'decide',version:1,outcome:'APPROVED',reason:'The evidence supports the recommendation'})).status,200);assert.equal(f.record.status,'APPROVED');assert.equal(f.record.decidedById,'owner-actor');
});
test('Superadmin cannot approve their own case or their own assigned recommendation',async()=>{
  for(const key of ['createdById','assignedToId']){const f=fixture();f.record[key]='owner-actor';assert.equal((await f.request('cases',{action:'decide',version:1,outcome:'APPROVED',reason:'QA reason'})).status,403);assert.equal(f.audits.length,0);}
});
test('Case version conflicts cannot overwrite another reviewer’s work',async()=>{
  const f=fixture();assert.equal((await f.request('cases',{...caseBody,version:0})).status,409);assert.equal(f.audits.length,0);
});
test('The owner adapter and HTTP permission check deny an undeclared capability',async()=>{
  const f=fixture();const adapter=load('src/lib/staff-access.ts',f.overrides);assert.equal(await adapter.currentStaff('future.permission'),null);
  const {staffRoute}=load('src/lib/staff-http.ts',f.overrides);let called=false;
  const response=await staffRoute('future.permission',async()=>{called=true;return new Response();})(new NextRequest(origin+'/api/private'));
  assert.equal(response.status,403);assert.equal(called,false);
});

test('Staff detail page requires authorization, scopes work by exact staff ID, and excludes participant accounts',async()=>{
  let authorized=false;const queries=[];
  const db={user:{async findUnique(){assert(authorized);return {id:'support-a',name:'QA Support',email:'qa@example.invalid',role:'SUPPORT',isBanned:false};}}};
  for(const model of ['supportTicket','workflowCase','adminAudit','staffSession'])db[model]={async count(input){queries.push([model,input]);return 0;},async findMany(input){queries.push([model,input]);return [];
  }};
  const overrides=new Map([
    [path.join(root,'src/lib/db.ts'),{db}],
    [path.join(root,'src/lib/staff-access.ts'),{async requireStaffPage(permission){assert.equal(permission,'operations');authorized=true;}}],
    [path.join(root,'src/lib/operations.ts'),{pageNumber:value=>Math.max(1,Number(value)||1)}],
  ]);
  const page=load('src/app/dashboard/staff/[id]/page.tsx',overrides).default;
  const markup=renderToStaticMarkup(await page({params:Promise.resolve({id:'support-a'}),searchParams:Promise.resolve({})}));
  assert(markup.includes('QA Support'));assert(markup.includes('No open support requests assigned.'));
  for(const [model,{where}]of queries)assert.equal(where[model==='supportTicket'?'assignedAdminId':model==='workflowCase'?'assignedToId':model==='adminAudit'?'actorId':'userId'],'support-a');
  db.supportTicket.count=async()=>41;
  db.supportTicket.findMany=async input=>{assert.equal(input.skip,20);assert.equal(input.take,20);return [];};
  const paged=renderToStaticMarkup(await page({params:Promise.resolve({id:'support-a'}),searchParams:Promise.resolve({tickets:'2',cases:'999',activity:'3'})}));
  assert(paged.includes('tickets=3&amp;cases=1&amp;activity=1'));
  db.user.findUnique=async()=>({id:'customer',role:'CUSTOMER'});
  await assert.rejects(()=>page({params:Promise.resolve({id:'customer'}),searchParams:Promise.resolve({})}),error=>String(error).includes('NEXT_HTTP_ERROR_FALLBACK;404'));
});

test('Grouped navigation renders all routes and highlights staff detail pages',()=>{
  const overrides=new Map([
    ['next/link',{__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)}],
    ['next/navigation',{usePathname:()=>'/dashboard/staff/support-a',useRouter:()=>({})}],
  ]);
  const {AdminShell}=load('src/app/dashboard/admin-shell.tsx',overrides);
  const markup=renderToStaticMarkup(React.createElement(AdminShell,{admin:{name:'QA Superadmin',email:'qa@example.invalid'}},'QA content'));
  for(const label of ['Platform management','Staff oversight','Bookings &amp; accounts'])assert(markup.includes(label));
  assert.equal((markup.match(/class="sidebar-link/g)||[]).length,15);
  assert.match(markup,/<a\b(?=[^>]*href="\/dashboard\/staff")(?=[^>]*aria-current="page")[^>]*>/);
  assert.equal((markup.match(/aria-current="page"/g)||[]).length,1);
});
