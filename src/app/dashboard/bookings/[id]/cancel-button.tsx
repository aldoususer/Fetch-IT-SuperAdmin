"use client";
import {RecordAction} from '@/components/record-action';
export function CancelButton({bookingId,disabled,reference,customerName,status,paymentNote}:{bookingId:string;disabled:boolean;reference?:string;customerName?:string;status?:string;paymentNote?:string}){
 return <RecordAction url={'/api/bookings/'+encodeURIComponent(bookingId)} action="cancel"
 label="Cancel booking" title="Cancel this booking?" target={reference??'Booking '+bookingId}
 details={[...(customerName?[{label:'Customer',value:customerName}]:[]),...(status?[{label:'Current status',value:status.replaceAll('_',' ').toLowerCase()}]:[])]}
 effect={'Stops this booking and records the cancellation. This cannot be undone. '+(paymentNote??'Check any payment or refund obligations separately.')}
 reasonHelp="Explain why this booking must be cancelled. The reason is recorded in booking and activity history."
 success="Booking cancelled. The reason has been recorded." danger disabled={disabled}/>;
}
