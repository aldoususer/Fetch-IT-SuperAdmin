const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..');
function hooks(){const values=[];let cursor=0;return {react:{...React,useId(){return 'qa-action';},useState(initial){const slot=cursor++;if(!(slot in values))values[slot]=typeof initial==='function'?initial():initial;return [values[slot],value=>{values[slot]=typeof value==='function'?value(values[slot]):value;}];},useRef(initial){const slot=cursor++;return values[slot]??={current:initial};}},render(Component,props){cursor=0;return Component(props);}};}
function elements(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(elements);return [tree,...elements(tree.props?.children)];}
function fixture(request){
 const h=hooks(),exports={},navigation={refreshes:0};
 const file=path.join(root,'src/components/record-action.tsx');
 new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(exports,name=>name==='react'?h.react:name==='next/navigation'?{useRouter:()=>({refresh(){navigation.refreshes++;}})}:name==='./identity-verification'?{useVerifiedRequest:()=>request}:require(name));
 const props={url:'/api/users/qa',action:'ban',label:'Restrict account',title:'Restrict this account?',effect:'The reason is shown to the account holder.',target:'Test Customer',details:[{label:'Email',value:'test@example.invalid'}],reasonHelp:'Recorded in history.',success:'Account restricted.',danger:true};
 const render=()=>h.render(exports.RecordAction,props);
 let tree=render(),opened=0,closed=0;
 elements(tree).find(e=>e.type==='dialog').props.ref.current={showModal(){opened++;},close(){closed++;}};
 elements(tree).find(e=>e.type==='button').props.onClick();tree=render();
 return {render,props,navigation,opened:()=>opened,closed:()=>closed,tree:()=>tree,reason(value){elements(tree).find(e=>e.type==='textarea').props.onChange({target:{value}});tree=render();},submit(){return elements(tree).find(e=>e.type==='form').props.onSubmit({preventDefault(){}});}};
}
test('Confirmation identifies the exact record and Cancel does not send a request',()=>{
 let calls=0;const f=fixture(async()=>{calls++;});assert.equal(f.opened(),1);
 assert(elements(f.tree()).some(e=>e.type==='strong'&&e.props.children==='Test Customer'));
 elements(f.tree()).find(e=>e.type==='button'&&e.props.children==='Cancel').props.onClick();
 assert.equal(f.closed(),1);assert.equal(calls,0);
});
for(const reason of ['', '   ','x'.repeat(501)])test('Invalid reason cannot trigger a write: '+reason.length,async()=>{
 let calls=0;const f=fixture(async()=>{calls++;});f.reason(reason);await f.submit();assert.equal(calls,0);
 assert(elements(f.render()).some(e=>e.props?.role==='alert'&&e.props.children.includes('1–500')));
});
test('Server errors retain the entered reason and expose the actual useful feedback',async()=>{
 const f=fixture(async()=>Response.json({error:'This account is no longer available.'},{status:404}));f.reason('Checked the reported evidence');await f.submit();
 const tree=f.render();assert.equal(elements(tree).find(e=>e.type==='textarea').props.value,'Checked the reported evidence');
 assert(elements(tree).some(e=>e.props?.role==='alert'&&e.props.children==='This account is no longer available.'));assert.equal(f.closed(),0);
});
test('A conflict cannot be retried as a different action until the user closes and reviews the refreshed record',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return Response.json({error:'The account was already changed.'},{status:409});});f.reason('QA explanation');await f.submit();
 let tree=f.render();assert(elements(tree).some(e=>e.type==='button'&&e.props.children==='Close & refresh record'));assert(!elements(tree).some(e=>e.type==='button'&&e.props.children==='Restrict account'&&!e.props.type));
 await elements(tree).find(e=>e.type==='form').props.onSubmit({preventDefault(){}});assert.equal(calls,1);
 elements(tree).find(e=>e.type==='button'&&e.props.children==='Close & refresh record').props.onClick();assert.equal(f.navigation.refreshes,1);assert.equal(f.closed(),1);
});
test('Pending submissions cannot run twice or close before the server responds',async()=>{
 let finish,calls=0;const f=fixture(()=>{calls++;return new Promise(resolve=>{finish=resolve;});});f.reason('QA reason');
 const first=f.submit();await f.submit();assert.equal(calls,1);let cancelled=false;
 elements(f.render()).find(e=>e.type==='dialog').props.onCancel({preventDefault(){cancelled=true;}});assert(cancelled);
 finish(Response.json({message:'Account restricted: Test Customer.'}));await first;
 const tree=f.render();assert(elements(tree).some(e=>e.props?.role==='status'&&e.props.className==='success-message'&&e.props.children==='Account restricted: Test Customer.'));
 assert.equal(elements(tree).find(e=>e.type==='textarea').props.value,'');assert.equal(f.closed(),1);
});
test('The open confirmation keeps its original action if refreshed props change underneath it',async()=>{
 let body;const f=fixture(async(url,init)=>{body=JSON.parse(init.body);return Response.json({message:'Saved.'});});
 f.props.action='unban';f.props.label='Lift restriction';f.render();f.reason('Original confirmed restriction');await f.submit();assert.equal(body.action,'ban');
});
