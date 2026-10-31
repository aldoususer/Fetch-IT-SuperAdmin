import {FARE_NUMBER_RULES, SETTING_NUMBER_RULES, limitValue} from './settings-limits';
import {VEHICLES} from './pricing-defaults';
const titles:Record<string,string>={OWNER_PASSWORD_SIGN_IN:'Superadmin signed in',OWNER_PASSWORD_CONFIRMED:'Identity verified',OWNER_PASSWORD_CHANGED:'Password changed',OWNER_PASSWORD_SET:'Password set',OWNER_PASSWORD_RESET:'Password reset',STAFF_CREATE:'Staff account created',STAFF_ROLE:'Staff role changed',STAFF_DISABLE:'Staff account disabled',STAFF_RESTORE:'Staff account restored',STAFF_REVOKE:'Staff signed out on all devices',PLATFORM_SETTINGS_CHANGED:'Platform rules updated',PLATFORM_SETTINGS_UPDATED:'Platform rules updated',SETTINGS_UPDATED:'Platform rules updated'};
export function eventTitle(action:string){return titles[action]??action.toLowerCase().replace(/^owner_/,'superadmin_').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());}
export function phTime(date:Date|string){return new Date(date).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})+' (PH)';}
const labels:Record<string,string>={rideEnabled:'Ride bookings',deliveryEnabled:'Delivery bookings',vehicles:'Available vehicles',role:'Role',disabled:'Account disabled',sessionsRevoked:'Signed out on all devices',email:'Email',status:'Status',assignedAdminId:'Assigned support staff',assignedToId:'Assigned reviewer',isBanned:'Account restricted'};
function fieldLabel(path:string){
 const [,vehicle,key]=path.split('.');
 if(path.startsWith('fares.')&&vehicle in VEHICLES&&key in FARE_NUMBER_RULES)return VEHICLES[vehicle as keyof typeof VEHICLES].label+' · '+FARE_NUMBER_RULES[key as keyof typeof FARE_NUMBER_RULES].label;
 return labels[path]??SETTING_NUMBER_RULES[path as keyof typeof SETTING_NUMBER_RULES]?.label??path.replaceAll('_',' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
}
function display(path:string,value:unknown){
 if(value===undefined||value===null)return 'Not set';
 if(typeof value==='boolean')return value?'Yes':'No';
 const rule=path.startsWith('fares.')?FARE_NUMBER_RULES[path.split('.')[2] as keyof typeof FARE_NUMBER_RULES]:SETTING_NUMBER_RULES[path as keyof typeof SETTING_NUMBER_RULES];
 if(rule&&typeof value==='number')return limitValue(value,rule);
 if(Array.isArray(value))return value.map(v=>String(v).toLowerCase()).sort().join(', ')||'None';
 return typeof value==='object'?JSON.stringify(value):String(value).replaceAll('_',' ');
}
export type Change={field:string;before:string;after:string};
export function describeChanges(before:unknown,after:unknown,prefix=''):Change[]{
 const left=before&&typeof before==='object'&&!Array.isArray(before)?before as Record<string,unknown>:{};
 const right=after&&typeof after==='object'&&!Array.isArray(after)?after as Record<string,unknown>:{};
 // Audit 'after' snapshots can contain only the fields changed by an action.
 return Object.keys(right).flatMap(key=>{
  const path=prefix?prefix+'.'+key:key,a=left[key],b=right[key];
  if(/password|token|secret|hash/i.test(path))return [];
  if(b&&typeof b==='object'&&!Array.isArray(b))return describeChanges(a,b,path);
  const from=display(path,a),to=display(path,b);
  return from===to?[]:[{field:fieldLabel(path),before:from,after:to}];
 });
}
