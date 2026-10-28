"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {LogoutButton} from './logout-button';
const links = [
  ['/dashboard', 'Dashboard'],
  ['/dashboard/staff', 'Manage staff access'],
  ['/dashboard/settings', 'Fares, commission & rules'],
  ['/dashboard/bookings', 'Bookings'],
  ['/dashboard/customers', 'Customer accounts'],
  ['/dashboard/riders', 'Rider accounts'],
  ['/dashboard/applications', 'Rider applications'],
  ['/dashboard/support', 'Support inbox'],
  ['/dashboard/cases', 'Cases & escalations'],
  ['/dashboard/finance', 'Payment records'],
  ['/dashboard/reports', 'Platform reports'],
  ['/dashboard/owner-audit', 'Superadmin activity log'],
  ['/dashboard/audit', 'Booking & staff activity'],
  ['/dashboard/owners', 'Superadmin accounts'],
  ['/dashboard/security', 'Password & active sessions'],
];
export function AdminShell({admin,children}:{admin:{name:string;email:string};children:React.ReactNode}){const pathname=usePathname(),[open,setOpen]=useState(false);return <div className="admin-shell">{open&&<button className="sidebar-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}<aside className={`admin-sidebar ${open?'is-open':''}`}><Link className="admin-brand" href="/dashboard"><img src="/fetch-logo-final.png" width="40" height="40" alt=""/><span>Fetch<small>SUPERADMIN</small></span></Link><nav aria-label="Owner navigation">{links.map(([href,label])=><Link key={href} className={`sidebar-link ${pathname===href?'active':''}`} href={href} onClick={()=>setOpen(false)} aria-current={pathname===href?'page':undefined}>{label}</Link>)}</nav><div className="sidebar-account"><strong>{admin.name}</strong><p>{admin.email}</p><LogoutButton/></div></aside><div className="admin-workspace"><header className="admin-header"><button className="btn mobile-menu" aria-label="Open owner navigation" aria-expanded={open} onClick={()=>setOpen(!open)}>☰</button><span>Fetch Owner Console</span><Link className="btn" href="/dashboard/security">Confirm identity / security</Link></header><main className="admin-main">{children}</main><footer className="admin-footer">Owner access · Individually approved accounts</footer></div></div>;}
