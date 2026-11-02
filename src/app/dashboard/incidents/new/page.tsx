import {requireStaffPage} from '@/lib/staff-access';
import {ActionForm} from '@/components/action-form';
export default async function Page(){
 await requireStaffPage();
 return <div><h1>Publish a verified platform incident</h1><p>The headline, affected scope, and operational instructions will be shared with staff. Keep names, exact locations, allegations, and investigation evidence in their restricted cases. This does not change booking or payment records.</p><ActionForm url="/api/incidents" label="Publish incident & notify staff" confirm fields={[
  {name:'category',label:'Incident category',required:true,options:[{value:'',label:'Choose a category'},{value:'INFRASTRUCTURE',label:'Shared service failure'},{value:'REGULATORY',label:'Platform-wide regulatory issue'},{value:'SAFETY_PATTERN',label:'Verified linked safety reports'},{value:'SUPPLY_DISRUPTION',label:'Widespread service availability disruption'}]},
  {name:'severity',label:'Severity',required:true,options:[{value:'HIGH',label:'High'},{value:'CRITICAL',label:'Critical'}]},
  {name:'title',label:'Staff-visible headline (up to 160 characters)',required:true},
  {name:'scope',label:'Affected area or services (up to 120 characters)',required:true},
  {name:'detail',label:'Staff-visible operational instructions (up to 500 characters)',type:'textarea',required:true},
  {name:'reason',label:'Internal reason and evidence reference (up to 500 characters)',type:'textarea',required:true}
 ]}/></div>;
}
