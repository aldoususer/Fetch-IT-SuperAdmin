import {StaffError} from './staff-http';

export function interventionReason(value:unknown) {
  if(typeof value!=='string'||!value.trim()||value.trim().length>500) {
    throw new StaffError('Explain why you are intervening, using up to 500 characters.');
  }
  return value.trim();
}
