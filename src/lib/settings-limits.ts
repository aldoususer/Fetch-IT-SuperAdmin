import {validatePlatformSettings, type PlatformSettings} from './platform-policy';
import {BOOKING_VEHICLE_CLASSES, VEHICLES} from './pricing-defaults';

export type NumberRule={label:string;min:number;max:number;step:number;currency?:boolean;unit?:string};

export const SETTING_NUMBER_RULES={
  commissionPercent:{label:'Demo commission (%)',min:0,max:100,step:.01,unit:'%'},
  offerSeconds:{label:'Rider offer duration (seconds)',min:30,max:600,step:1,unit:'seconds'},
  maxReassignments:{label:'Maximum previous riders before another manual offer',min:0,max:20,step:1},
  maxSurge:{label:'Maximum surge multiplier',min:1,max:2,step:.01},
  morningSurge:{label:'Morning surge (07:00–09:59)',min:1,max:2,step:.01},
  eveningSurge:{label:'Evening surge (17:00–20:59)',min:1,max:2,step:.01},
  nightSurge:{label:'Night surge (22:00–05:59)',min:1,max:2,step:.01},
  fridayExtra:{label:'Friday evening extra multiplier',min:0,max:.5,step:.01},
} satisfies Record<string,NumberRule>;

// Save-time guardrails for the currently bookable local services. Keep these
// separate from reading existing configuration so older fares can be corrected.
export const FARE_NUMBER_RULES={
  baseFare:{label:'Base fare',min:0,max:1000,step:.01,currency:true},
  minimumFare:{label:'Minimum fare',min:0,max:1000,step:.01,currency:true},
  includedKm:{label:'Included distance',min:0,max:100000,step:.01,unit:'km'},
  perKm:{label:'Per km',min:0,max:100,step:.01,currency:true},
  longHaulPerKm:{label:'Long-haul per km',min:0,max:100,step:.01,currency:true},
  freeWeightKg:{label:'Included weight',min:0,max:100000,step:.01,unit:'kg'},
  perKgOverFree:{label:'Per extra kg',min:0,max:100,step:.01,currency:true},
} satisfies Record<keyof PlatformSettings['fares'][string],NumberRule>;

export function limitValue(value:number,rule:NumberRule) {
  return rule.currency?`₱${value.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`:`${value.toLocaleString('en-PH')}${rule.unit?' '+rule.unit:''}`;
}

export function limitHint(rule:NumberRule) {
  return `Allowed: ${limitValue(rule.min,rule)}–${limitValue(rule.max,rule)}. ${rule.step===1?'Whole numbers only.':'Up to 2 decimal places.'}`;
}

function issue(value:unknown,rule:NumberRule,label:string) {
  if(typeof value!=='number'||!Number.isFinite(value))return `${label}: enter a valid number. ${limitHint(rule)}`;
  if(value<rule.min)return `${label} cannot be below ${limitValue(rule.min,rule)}.`;
  if(value>rule.max)return `${label} cannot exceed ${limitValue(rule.max,rule)}. This change cannot be saved.`;
  if(rule.step===1&&!Number.isInteger(value))return `${label} must be a whole number.`;
  if(Math.abs(Math.round(value*100)-value*100)>.00001)return `${label} can have at most 2 decimal places.`;
  return '';
}

export function settingsUpdateIssues(value:unknown):Record<string,string> {
  if(!value||typeof value!=='object'||Array.isArray(value))return {settings:'Choose valid platform settings.'};
  const input=value as Record<string,unknown>,errors:Record<string,string>={};
  for(const [key,rule]of Object.entries(SETTING_NUMBER_RULES)){
    const message=issue(input[key],rule,rule.label);if(message)errors[key]=message;
  }
  const fares=input.fares as PlatformSettings['fares']|undefined;
  for(const vehicle of BOOKING_VEHICLE_CLASSES)for(const [key,rule]of Object.entries(FARE_NUMBER_RULES)){
    const field=key as keyof typeof FARE_NUMBER_RULES;
    const message=issue(fares?.[vehicle]?.[field],rule,`${VEHICLES[vehicle].label} ${rule.label.toLowerCase()}`);
    if(message)errors[`fares.${vehicle}.${field}`]=message;
  }
  return errors;
}

export function validateSettingsUpdate(value:unknown):PlatformSettings {
  const first=Object.values(settingsUpdateIssues(value))[0];
  if(first)throw new Error(first);
  return validatePlatformSettings(value);
}
