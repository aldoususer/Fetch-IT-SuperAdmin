const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..');
function loader(mocks={}){
 const cache=new Map();
 function load(file){
  const filename=path.resolve(root,file);if(cache.has(filename))return cache.get(filename);
  const exports={};cache.set(filename,exports);
  function localRequire(name){
   if(Object.hasOwn(mocks,name))return mocks[name];
   if(name==='server-only')return {};
   if(name.startsWith('@/')||name.startsWith('.')){
    const base=name.startsWith('@/')?path.join(root,'src',name.slice(2)):path.resolve(path.dirname(filename),name);
    return load(base+(fs.existsSync(base+'.ts')?'.ts':'.tsx'));
   }
   return require(name);
  }
  new Function('exports','require',ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(exports,localRequire);
  return exports;
 }
 return load;
}
function hooks(){
 const values=[];let cursor=0;
 return {react:{...React,useState(initial){const slot=cursor++;if(!(slot in values))values[slot]=typeof initial==='function'?initial():initial;return [values[slot],value=>{values[slot]=typeof value==='function'?value(values[slot]):value;}];},useRef(initial){const slot=cursor++;if(!(slot in values))values[slot]={current:initial};return values[slot];},useId(){return 'qa';},useEffect(){},useContext(){return (url,init)=>fetch(url,init);}},render(component,props){cursor=0;return component(props);}};
}
function elements(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(elements);return [tree,...elements(tree.props?.children)];}
const emptyLink={__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)};
const navigation={useRouter:()=>({refresh(){},push(){}})};
const base=loader(),{defaultPlatformSettings}=base('src/lib/platform-policy.ts'),{describeChanges,eventTitle}=base('src/lib/ux-labels.ts');
test('Human change summaries show exact changed values, ignore array order, and hide secrets',()=>{
 const a=defaultPlatformSettings(),b=structuredClone(a);b.fares.MOTORCYCLE.baseFare=70;b.vehicles.reverse();
 const changes=describeChanges(a,b);assert.equal(changes.length,1);assert.equal(changes[0].field,'Motorcycle · Base fare');assert.equal(changes[0].before,'₱60.00');assert.equal(changes[0].after,'₱70.00');
 assert.equal(describeChanges({passwordHash:'old'},{passwordHash:'new'}).length,0);assert.equal(describeChanges({role:'SUPPORT',disabled:false},{role:'ADMIN'}).length,1);assert.equal(eventTitle('OWNER_PASSWORD_SIGN_IN'),'Superadmin signed in');
});
test('Staff creation starts with no role and uses new-password autofill semantics',()=>{
 const load=loader({'next/navigation':navigation});
 const Component=load('src/components/staff-access-form.tsx').StaffAccessForm;
 const html=renderToStaticMarkup(React.createElement(Component));
 assert.match(html,/<option value="" selected="">Choose a role/);assert.match(html,/autoComplete="new-password"/);assert.match(html,/minLength="14"/);assert(!html.includes('value="ADMIN" selected'));assert(html.includes('Choose a role to see'));
});
test('Settings review preserves edits, shows before/after, and performs no write until final confirmation',async()=>{
 const h=hooks(),calls=[];
 const load=loader({react:h.react,'next/navigation':navigation});
 const Component=load('src/components/settings-form.tsx').SettingsForm,props={initial:defaultPlatformSettings(),version:8};
 let tree=h.render(Component,props);
 assert.equal(elements(tree).find(e=>e.type==='button'&&e.props.children==='Review changes').props.disabled,true);
 elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare').props.onChange(70);
 tree=h.render(Component,props);elements(tree).find(e=>e.type==='textarea').props.onChange({target:{value:'Adjust local pricing'}});
 tree=h.render(Component,props);
 let opened=0,closed=0;elements(tree).find(e=>e.type==='dialog').props.ref.current={showModal(){opened++;},close(){closed++;}};
 const old=global.fetch;global.fetch=async(url,init)=>{calls.push([url,JSON.parse(init.body)]);return Response.json({message:'Platform rules saved.',version:9});};
 try{
  tree.props.children[0].props.onSubmit({preventDefault(){}});
  assert.equal(opened,1);assert.equal(calls.length,0);
  elements(tree).find(e=>e.type==='button'&&e.props.children==='Back to editing').props.onClick();
  assert.equal(closed,1);tree=h.render(Component,props);
  assert.equal(elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare').props.value,70);
  const confirm=elements(tree).find(e=>e.type==='button'&&typeof e.props.children==='string'&&/^Save [0-9]+ change/.test(e.props.children));await confirm.props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);assert.equal(calls[0][1].version,8);assert.equal(calls[0][1].settings.fares.MOTORCYCLE.baseFare,70);assert.equal(calls[0][1].reason,'Adjust local pricing');
  tree=h.render(Component,props);assert.equal(elements(tree).find(e=>e.type==='button'&&e.props.children==='Review changes').props.disabled,true);
  assert(elements(tree).some(e=>e.props?.role==='status'&&e.props.children==='Platform rules saved.'));
 }finally{global.fetch=old;}
});
for(const cancel of [false,true])test('Expired verification '+(cancel?'can be cancelled without retrying the write':'retries the same pending change after verification'),async()=>{
 const h=hooks(),load=loader({react:h.react}),Component=load('src/components/identity-verification.tsx').IdentityVerificationProvider,calls=[];
 let tree=h.render(Component,{children:'form'});const dialog=elements(tree).find(e=>e.type==='dialog');let opened=0;dialog.props.ref.current={showModal(){opened++;},close(){}};
 const oldFetch=global.fetch,oldWindow=global.window;global.window={dispatchEvent(){}};global.fetch=async(url,init)=>{
  calls.push([url,JSON.parse(init.body)]);
  if(url==='/api/owner-auth')return Response.json({message:'Verified'});
  return calls.length===1?Response.json({error:'Confirm your password in Security & sessions before continuing.'},{status:401}):Response.json({message:'Saved'});
 };
 try{
  const payload={method:'POST',body:JSON.stringify({version:7,reason:'QA reason'})},waiting=tree.props.value('/api/settings',payload);
  const settled=waiting.then(value=>({value}),error=>({error}));await new Promise(resolve=>setImmediate(resolve));assert.equal(opened,1);
  tree=h.render(Component,{children:'form'});
  if(cancel){elements(tree).find(e=>e.type==='button'&&e.props.children==='Cancel').props.onClick();const result=await settled;assert.match(result.error.message,/cancelled/);assert.equal(calls.length,1);}
  else{
   elements(tree).find(e=>e.type==='input').props.onChange({target:{value:'synthetic test only password'}});
   tree=h.render(Component,{children:'form'});await elements(tree).find(e=>e.type==='form').props.onSubmit({preventDefault(){}});
   assert.equal((await settled).value.status,200);assert.deepEqual(calls[0],calls[2]);assert.equal(calls[1][0],'/api/owner-auth');
   tree=h.render(Component,{children:'form'});assert.equal(elements(tree).find(e=>e.type==='input').props.value,'');
  }
 }finally{global.fetch=oldFetch;global.window=oldWindow;}
});
test('Dashboard attention destination includes awaiting replies from both active statuses',async()=>{
 let actualWhere;
 const tickets=[
  {id:'open',status:'OPEN',lastAdminReplyAt:null,lastCustomerMessageAt:3},
  {id:'review',status:'IN_PROGRESS',lastAdminReplyAt:1,lastCustomerMessageAt:2},
  {id:'answered',status:'IN_PROGRESS',lastAdminReplyAt:3,lastCustomerMessageAt:2},
  {id:'closed',status:'RESOLVED',lastAdminReplyAt:null,lastCustomerMessageAt:2},
 ];
 const matches=(ticket,where)=>Object.entries(where).every(([key,value])=>key==='AND'?value.every(w=>matches(ticket,w)):key==='OR'?value.some(w=>matches(ticket,w)):key==='status'?typeof value==='string'?ticket.status===value:value.in.includes(ticket.status):key==='lastAdminReplyAt'?ticket[key]===value:key==='lastCustomerMessageAt'?ticket[key]>ticket.lastAdminReplyAt:true);
 const db={supportTicket:{fields:{lastAdminReplyAt:{ref:'lastAdminReplyAt'}},async count({where}){actualWhere=where;return tickets.filter(t=>matches(t,where)).length+20;},async findMany({where}){return tickets.filter(t=>matches(t,where)).map(t=>({...t,category:'OTHER',customer:{name:'Synthetic'},booking:null,assignedAdmin:null,messages:[],createdAt:new Date('2026-10-01')}));}}};
 const load=loader({'@/lib/db':{db},'next/link':emptyLink,'@/lib/staff-access':{requireStaffPage:async()=>({id:'owner',role:'SUPERADMIN'})},'./queue-filters':{QueueFilters:()=>null},'./action-form':{ActionForm:()=>null}});
 const Page=load('src/components/review-pages.tsx').SupportPage;
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({unanswered:'1'})}));
 assert(html.includes('ticket-open'));assert(html.includes('ticket-review'));assert(!html.includes('ticket-answered'));assert(!html.includes('ticket-closed'));assert(html.includes('22 requests'));
 assert(!actualWhere.AND.some(value=>value.status==='OPEN'));assert(html.includes('unanswered=1'));
});
test('An invalid date never queries activity history',async()=>{
 let calls=0;const load=loader({'next/link':emptyLink,'@/lib/db':{db:{ownerAudit:{count(){calls++;},findMany(){calls++;}}}},'@/lib/staff-access':{requireStaffPage:async()=>({role:'SUPERADMIN'})}});
 const Page=load('src/app/dashboard/owner-audit/page.tsx').default;
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({from:'garbage'})}));
 assert.equal(calls,0);assert(html.includes('role="alert"'));
});

test('Discard confirmation can be cancelled without losing settings',()=>{
 const h=hooks(),load=loader({react:h.react,'next/navigation':navigation}),Component=load('src/components/settings-form.tsx').SettingsForm,props={initial:defaultPlatformSettings(),version:8};
 let tree=h.render(Component,props);elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare').props.onChange(75);tree=h.render(Component,props);
 let opened=0;elements(tree).filter(e=>e.type==='dialog').at(-1).props.ref.current={showModal(){opened++;},close(){}};
 elements(tree).find(e=>e.type==='button'&&e.props.children==='Discard changes'&&e.props.type==='button').props.onClick();
 assert.equal(opened,1);elements(tree).find(e=>e.type==='button'&&e.props.children==='Keep editing').props.onClick();
 tree=h.render(Component,props);assert.equal(elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare').props.value,75);
 elements(tree).filter(e=>e.type==='button'&&e.props.children==='Discard changes').at(-1).props.onClick();
 tree=h.render(Component,props);assert.equal(elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare').props.value,60);
 assert(elements(tree).some(e=>e.props?.role==='status'&&e.props.children==='Unsaved changes discarded.'));
});

test('A conflicting settings save retains the reason and draft until explicitly discarded',async()=>{
 const h=hooks(),load=loader({react:h.react,'next/navigation':navigation}),Component=load('src/components/settings-form.tsx').SettingsForm,props={initial:defaultPlatformSettings(),version:8};
 let tree=h.render(Component,props);elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare').props.onChange(75);tree=h.render(Component,props);
 elements(tree).find(e=>e.type==='textarea').props.onChange({target:{value:'Keep this explanation'}});tree=h.render(Component,props);
 const old=global.fetch;global.fetch=async()=>Response.json({error:'Another Superadmin changed these settings.'},{status:409});
 try{
  elements(tree).find(e=>e.type==='button'&&typeof e.props.children==='string'&&/^Save [0-9]+ change/.test(e.props.children)).props.onClick();
  await new Promise(resolve=>setImmediate(resolve));tree=h.render(Component,props);
  assert.equal(elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare').props.value,75);
  assert.equal(elements(tree).find(e=>e.type==='textarea').props.value,'Keep this explanation');
  assert(elements(tree).some(e=>e.props?.role==='alert'&&e.props.children==='Another Superadmin changed these settings.'));
  assert(elements(tree).some(e=>e.type==='button'&&e.props.children==='Discard draft & load latest'));
 }finally{global.fetch=old;}
});
