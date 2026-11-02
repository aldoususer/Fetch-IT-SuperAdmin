'use client';
import Link from 'next/link';
import {NotificationInbox} from '@/components/notification-inbox';
export function AdminInbox({adminId}:{adminId:string}){return <NotificationInbox key={adminId} actorId={adminId} role="SUPERADMIN" renderLink={(item,children,onNavigate)=><Link className="inbox-item" href={item.href} onClick={onNavigate}>{children}</Link>}/>;}
