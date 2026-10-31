"use client";
import {RecordAction} from '@/components/record-action';
export function BanButton({userId,isBanned,userName,userEmail}:{userId:string;isBanned:boolean;userName?:string;userEmail?:string}){
 return <RecordAction url={'/api/users/'+encodeURIComponent(userId)} action={isBanned?'unban':'ban'}
 label={isBanned?'Lift restriction':'Restrict account'} title={isBanned?'Lift this account restriction?':'Restrict this account?'}
 target={userName??'Account '+userId} details={userEmail?[{label:'Email',value:userEmail}]:[{label:'Account ID',value:userId}]}
 effect={isBanned?'Restores access to this account. The previous restriction remains in activity history.':'Restricts this account. The reason is shown to the account holder. Existing bookings keep their current status.'}
 reasonHelp={isBanned?'Explain why access should be restored. This is recorded in activity history.':'Explain why this restriction is needed. This is shown to the account holder and recorded in activity history.'}
 success={isBanned?'Account restriction lifted.':'Account restricted.'} danger={!isBanned}/>;
}
