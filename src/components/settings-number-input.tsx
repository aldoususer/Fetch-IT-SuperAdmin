import {limitHint,limitValue,type NumberRule} from '@/lib/settings-limits';

export function SettingsNumberInput({id,value,previous,rule,error,onChange}:{id:string;value:number;previous:number;rule:NumberRule;error?:string;onChange:(value:number)=>void}) {
  return <label htmlFor={id} style={{alignSelf:'start'}}>{rule.label}
    <input id={id} className="input" type="number" required min={rule.min} max={rule.max} step={rule.step}
      value={Number.isFinite(value)?value:''} onChange={event=>onChange(event.target.valueAsNumber)}
      aria-invalid={!!error} aria-describedby={`${id}-limit${error?` ${id}-error`:''}`}/>
    <small id={`${id}-limit`}>{limitHint(rule)} Previous: {limitValue(previous,rule)}</small>
    {error&&<span id={`${id}-error`} className="error-message" role="alert">{error}</span>}
  </label>;
}
