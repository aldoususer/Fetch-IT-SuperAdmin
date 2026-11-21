const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(file,mocks={}) {
 const source=ts.transpileModule(fs.readFileSync(path.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('exports','require',source)(exports,name=>name in mocks?mocks[name]:require(name));return exports;
}
const presentation=load('src/lib/support-presentation.ts');
test('opening fallback is hidden only for the same customer message at the opening timestamp',()=>{
 const createdAt=new Date('2026-11-21T04:00:00Z'),message='Please trace my lost umbrella.';
 const ticket={message,createdAt,messages:[]};assert.equal(presentation.hasOpeningMessage(ticket),false);
 const opening={body:message,createdAt,authorRole:'CUSTOMER'};ticket.messages=[opening];assert.equal(presentation.hasOpeningMessage(ticket),true);
 for(const change of [{createdAt:new Date(createdAt.getTime()+60000)},{authorRole:'SUPPORT'},{body:'Different message'}]){ticket.messages=[{...opening,...change}];assert.equal(presentation.hasOpeningMessage(ticket),false);}
});
test('support summaries keep emergency telemetry out of queue titles',()=>{
 assert.equal(presentation.supportSubject('URGENT SAFETY ALERT\nGPS: private-location','RIDER'),'Passenger safety alert');
 assert.equal(presentation.supportSubject('  Please\n help   trace my parcel. ','OTHER'),'Please help trace my parcel.');
});
function harness(responseStatus=200) {
 const values=[],calls=[];let cursor=0;
 const react={...require('react'),useState(initial){const slot=cursor++;if(!(slot in values))values[slot]=typeof initial==='function'?initial():initial;return [values[slot],value=>values[slot]=typeof value==='function'?value(values[slot]):value];},useRef(initial){const slot=cursor++;return values[slot]??(values[slot]={current:initial});}};
 const request=async(url,init)=>{const body=JSON.parse(init.body);calls.push(body);return Response.json(responseStatus===200?{ticket:{status:body.status,assignedAdminId:body.assignedAdminId,updatedAt:'2026-11-21T04:02:00.000Z'}}:{error:'This request has changed. Your draft is kept.'},{status:responseStatus});};
 const component=load('src/app/dashboard/support/reply-form.tsx',{react,'@/components/identity-verification':{useVerifiedRequest:()=>request},'next/navigation':{useRouter:()=>({refresh(){}})}}).ReplyForm;
 const props={id:'fixture',status:'OPEN',assignedAdminId:'staff-a',updatedAt:'2026-11-21T04:00:00.000Z',admins:[{id:'staff-a',name:'Agent A'},{id:'staff-b',name:'Agent B'}]};
 return {calls,render(){cursor=0;return component(props);}};
}
function elements(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(elements);return [node,...elements(node.props?.children)];}
function form(tree,label){return elements(tree).find(node=>node.type==='form'&&node.props['aria-label']===label);}
function input(tree,label){const parent=elements(tree).find(node=>node.type==='label'&&Array.isArray(node.props.children)&&node.props.children[0]===label);return elements(parent).find(node=>['textarea','select','input'].includes(node.type));}
const event={preventDefault(){}};
test('reply ignores unsaved assignment controls and sends only its own message',async()=>{
 const h=harness();let tree=h.render();input(tree,'Assigned support staff').props.onChange({target:{value:'staff-b'}});
 input(tree,'Reply to customer').props.onChange({target:{value:'Please keep the receipt.'}});input(tree,'Reason for replying (internal only)').props.onChange({target:{value:'Clarify the next step'}});
 tree=h.render();await form(tree,'Customer reply').props.onSubmit(event);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.calls[0].intent,'reply');assert.equal(h.calls[0].assignedAdminId,'staff-a');assert.equal(h.calls[0].reply,'Please keep the receipt.');
 tree=h.render();assert.equal(input(tree,'Reply to customer').props.value,'');assert.equal(input(tree,'Assigned support staff').props.value,'staff-b');
});
test('assignment review makes no request until confirmed and excludes the public draft',async()=>{
 const h=harness();let tree=h.render();input(tree,'Assigned support staff').props.onChange({target:{value:'staff-b'}});input(tree,'Reason for change (internal only)').props.onChange({target:{value:'Balance team workload'}});input(tree,'Reply to customer').props.onChange({target:{value:'Unsent customer draft'}});
 tree=h.render();form(tree,'Assignment and status').props.onSubmit(event);assert.equal(h.calls.length,0);
 tree=h.render();const button=elements(tree).find(node=>node.type==='button'&&node.props.children==='Save assignment & status');assert(button);button.props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.calls[0].intent,'manage');assert.equal(h.calls[0].reply,'');assert.equal(h.calls[0].assignedAdminId,'staff-b');
 tree=h.render();assert.equal(input(tree,'Reply to customer').props.value,'Unsent customer draft');
});
test('version conflicts preserve reply and internal reason for recovery',async()=>{
 const h=harness(409);let tree=h.render();input(tree,'Reply to customer').props.onChange({target:{value:'Keep this draft'}});input(tree,'Reason for replying (internal only)').props.onChange({target:{value:'Keep this reason'}});
 tree=h.render();form(tree,'Customer reply').props.onSubmit(event);await new Promise(resolve=>setImmediate(resolve));
 tree=h.render();assert.equal(input(tree,'Reply to customer').props.value,'Keep this draft');assert.equal(input(tree,'Reason for replying (internal only)').props.value,'Keep this reason');assert(elements(tree).some(node=>node.props?.role==='alert'));
});
const defaults=load('src/lib/pricing-defaults.ts');
const policy=load('src/lib/platform-policy.ts',{'./pricing-defaults':defaults});
const limits=load('src/lib/settings-limits.ts',{'./platform-policy':policy,'./pricing-defaults':defaults});
test('included weight respects each vehicle capacity and included distance has a local-service ceiling',()=>{
 for(const [vehicle,capacity]of [['MOTORCYCLE',5],['TRICYCLE',10],['SEDAN',20]]){
  const settings=policy.defaultPlatformSettings();settings.fares[vehicle].freeWeightKg=capacity;assert.doesNotThrow(()=>limits.validateSettingsUpdate(settings));
  settings.fares[vehicle].freeWeightKg=capacity+.01;assert.match(limits.settingsUpdateIssues(settings)[`fares.${vehicle}.freeWeightKg`],/cannot exceed/);
  settings.fares[vehicle].freeWeightKg=capacity;settings.fares[vehicle].includedKm=100.01;assert.match(limits.settingsUpdateIssues(settings)[`fares.${vehicle}.includedKm`],/cannot exceed 100 km/);
 }
});
const queues=load('src/lib/application-queue.ts');
test('every stored application stage maps to an available queue with the same visible label',()=>{
 for(const stage of ['DRAFT','SUBMITTED','IN_REVIEW','NEEDS_CORRECTION','RECOMMENDED','ORIENTATION_SCHEDULED','ASSESSED','DEMO_COMPLETED','ACTIVE','REJECTED','FORCE_APPROVAL_PENDING']){
  const filter=queues.normalizeApplicationFilter(stage);assert(filter,stage);assert(queues.applicationQueueStatuses(filter).includes(stage));assert.equal(queues.applicationStageLabel(stage),queues.APPLICATION_STATUS_FILTERS.find(item=>item.value===filter).label);
 }
});
