const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {NextRequest}=require('next/server');
const root=path.resolve(__dirname,'..');
const origin='https://settings-test.example.invalid';
function loader(mocks={}){
  const cache=new Map();
  function load(file){
    const filename=path.resolve(root,file);if(cache.has(filename))return cache.get(filename);
    const exports={};cache.set(filename,exports);
    function localRequire(name){
      if(Object.hasOwn(mocks,name))return mocks[name];
      if(name==='server-only')return {};
      if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?path.join(root,'src',name.slice(2)):path.resolve(path.dirname(filename),name);return load(base+(fs.existsSync(base+'.ts')?'.ts':'.tsx'));}
      return require(name);
    }
    new Function('exports','require',ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(exports,localRequire);return exports;
  }return load;
}
const load=loader(),policy=load('src/lib/platform-policy.ts'),limits=load('src/lib/settings-limits.ts');
test('Current default settings remain valid',()=>assert.deepEqual(limits.validateSettingsUpdate(policy.defaultPlatformSettings()),policy.defaultPlatformSettings()));
for(const vehicle of ['MOTORCYCLE','TRICYCLE','SEDAN'])for(const [field,max]of [['baseFare',1000],['minimumFare',1000],['perKm',100],['longHaulPerKm',100],['perKgOverFree',100]]){
  test(`${vehicle} ${field}: exact limit is allowed and one cent over is rejected`,()=>{
    const settings=policy.defaultPlatformSettings();settings.fares[vehicle][field]=max;assert.doesNotThrow(()=>limits.validateSettingsUpdate(settings));
    settings.fares[vehicle][field]=max+.01;assert.throws(()=>limits.validateSettingsUpdate(settings),/cannot exceed ₱[\d,]+\.00/);
    settings.fares[vehicle][field]=1e20;assert.throws(()=>limits.validateSettingsUpdate(settings),/This change cannot be saved/);
  });
}
for(const [description,value]of [['negative',-1],['blank',NaN],['infinite',Infinity],['text','999999'],['three decimal places',10.001],['missing',undefined]])test(`Invalid fare: ${description}`,()=>{
  const settings=policy.defaultPlatformSettings();settings.fares.MOTORCYCLE.baseFare=value;
  assert(limits.settingsUpdateIssues(settings)['fares.MOTORCYCLE.baseFare']);assert.throws(()=>limits.validateSettingsUpdate(settings));
});
test('Percentages, surge and whole-number controls have specific feedback',()=>{
  for(const [field,value,message]of [['commissionPercent',101,/cannot exceed 100/],['maxSurge',999,/cannot exceed 2/],['offerSeconds',1,/cannot be below 30/],['maxReassignments',2.5,/whole number/]]){
    const settings={...policy.defaultPlatformSettings(),[field]:value};assert.throws(()=>limits.validateSettingsUpdate(settings),message);
  }
});
test('Legacy saved prices remain readable while new excessive updates are denied',()=>{
  const settings=policy.defaultPlatformSettings();settings.fares.MOTORCYCLE.baseFare=5000;
  assert.doesNotThrow(()=>policy.validatePlatformSettings(settings));assert.throws(()=>limits.validateSettingsUpdate(settings),/cannot exceed/);
});

function endpoint({fresh=true}={}){
  const writes=[],audits=[];let transactions=0;
  const db={async $transaction(fn){transactions++;return fn(db);},async $executeRaw(){},platformConfig:{async findUnique(){return null;},async upsert({create}){writes.push(create);}},ownerAudit:{async create({data}){audits.push(data);}}};
  const owner={id:'owner-identity',name:'QA owner'};
  const api=loader({'@/lib/db':{db},'./owner-auth':{ownerConfig:()=>({origin}),currentOwner:async()=>fresh?owner:null}})('src/app/api/settings/route.ts');
  return {writes,audits,transactions:()=>transactions,async save(settings,requestOrigin=origin){return api.POST(new NextRequest(origin+'/api/settings',{method:'POST',headers:{'Content-Type':'application/json',origin:requestOrigin},body:JSON.stringify({version:0,settings,reason:'QA guarded configuration change'})}));}};
}
test('The real settings handler rejects an excessive request before entering a transaction',async()=>{
  const f=endpoint();const settings=policy.defaultPlatformSettings();settings.fares.MOTORCYCLE.perKm=1000000;
  const response=await f.save(settings);assert.equal(response.status,400);assert.match((await response.json()).error,/Motorcycle per km cannot exceed ₱100\.00/);assert.equal(f.transactions(),0);assert.equal(f.writes.length,0);assert.equal(f.audits.length,0);
});
test('Valid boundary prices are saved and audited',async()=>{
  const f=endpoint();const settings=policy.defaultPlatformSettings();settings.fares.MOTORCYCLE.baseFare=1000;
  assert.equal((await f.save(settings)).status,200);assert.equal(f.writes[0].settings.fares.MOTORCYCLE.baseFare,1000);assert.equal(f.audits[0].actorId,'owner-identity');assert.equal(f.audits[0].details.after.fares.MOTORCYCLE.baseFare,1000);
});
test('Existing fresh-password and origin requirements remain enforced',async()=>{
  const stale=endpoint({fresh:false});assert.equal((await stale.save(policy.defaultPlatformSettings())).status,401);assert.equal(stale.transactions(),0);
  const foreign=endpoint();assert.equal((await foreign.save(policy.defaultPlatformSettings(),'https://foreign.invalid')).status,403);assert.equal(foreign.transactions(),0);
});

function hooks(){const values=[];let cursor=0;return {react:{...require('react'),useState(initial){const slot=cursor++;if(!(slot in values))values[slot]=typeof initial==='function'?initial():initial;return [values[slot],value=>{values[slot]=typeof value==='function'?value(values[slot]):value;}];},useEffect(){},useRef(initial){const slot=cursor++;if(!(slot in values))values[slot]={current:initial};return values[slot];},useId(){return 'test';},useContext(){return (url,init)=>fetch(url,init);}},render(component,props){cursor=0;return component(props);}};}
function elements(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(elements);return [tree,...elements(tree.props?.children)];}
test('Typing an excessive amount shows a specific field error and disables Save immediately',async()=>{
  const h=hooks(),component=loader({react:h.react,'next/navigation':{useRouter:()=>({refresh(){}})}})('src/components/settings-form.tsx').SettingsForm;
  const props={initial:policy.defaultPlatformSettings(),version:0};let tree=h.render(component,props);
  const field=elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare');assert(field);
  field.props.onChange(1000000);tree=h.render(component,props);
  const next=elements(tree).find(e=>e.props?.id==='fare-MOTORCYCLE-baseFare');assert.match(next.props.error,/Motorcycle base fare cannot exceed ₱1,000\.00/);
  const save=elements(tree).find(e=>e.type==='button'&&e.props.children==='Review changes');assert.equal(save.props.disabled,true);
  let calls=0;const previous=global.fetch;global.fetch=async()=>{calls++;throw Error('Unexpected network call');};
  try{await elements(tree).find(e=>e.type==="form").props.onSubmit({preventDefault(){}});assert.equal(calls,0);}finally{global.fetch=previous;}
  next.props.onChange(60);tree=h.render(component,props);assert.equal(elements(tree).find(e=>e.type==='button'&&e.props.children==='Review changes').props.disabled,true);
});
test('Number fields expose native bounds and accessible error feedback',()=>{
  const Field=load('src/components/settings-number-input.tsx').SettingsNumberInput;
  const tree=Field({id:'test-fare',value:NaN,previous:60,rule:limits.FARE_NUMBER_RULES.baseFare,error:'Amount is too large',onChange(){}});
  const input=elements(tree).find(e=>e.type==='input');assert.equal(input.props.max,1000);assert.equal(input.props.min,0);assert.equal(input.props.step,.01);assert.equal(input.props['aria-invalid'],true);assert.equal(input.props.value,'');assert(elements(tree).some(e=>e.props?.role==='alert'));
});
