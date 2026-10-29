"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {LogoutButton} from './logout-button';
const groups = [
  {label: 'Platform management', links: [
    ['/dashboard', 'Dashboard'],
    ['/dashboard/settings', 'Fares, commission & rules'],
    ['/dashboard/owners', 'Superadmin accounts'],
    ['/dashboard/security', 'Password & active sessions'],
    ['/dashboard/owner-audit', 'Superadmin activity log'],
  ]},
  {label: 'Staff oversight', links: [
    ['/dashboard/staff', 'Staff accounts & assigned work'],
    ['/dashboard/support', 'Support inbox'],
    ['/dashboard/cases', 'Cases & escalations'],
    ['/dashboard/finance', 'Payment records'],
    ['/dashboard/audit', 'Booking & staff activity'],
  ]},
  {label: 'Bookings & accounts', links: [
    ['/dashboard/bookings', 'Bookings'],
    ['/dashboard/customers', 'Customer accounts'],
    ['/dashboard/riders', 'Rider accounts'],
    ['/dashboard/applications', 'Rider applications'],
    ['/dashboard/reports', 'Platform reports'],
  ]},
];
export function AdminShell({admin,children}:{admin:{name:string;email:string};children:React.ReactNode}) {
  const pathname=usePathname(),[open,setOpen]=useState(false);
  return <div className="admin-shell">
    {open&&<button className="sidebar-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <aside className={`admin-sidebar ${open?'is-open':''}`}>
      <Link className="admin-brand" href="/dashboard"><img src="/fetch-logo-final.png" width="40" height="40" alt=""/><span>Fetch<small>SUPERADMIN</small></span></Link>
      <nav id="owner-navigation" aria-label="Superadmin navigation">
        {groups.map((group,index)=><section className="sidebar-group" key={group.label} aria-labelledby={`sidebar-group-${index}`}>
          <h2 id={`sidebar-group-${index}`} className="sidebar-group-heading">{group.label}</h2>
          {group.links.map(([href,label])=>{
            const active=pathname===href||(href!=='/dashboard'&&pathname.startsWith(`${href}/`));
            return <Link key={href} className={`sidebar-link ${active?'active':''}`} href={href} onClick={()=>setOpen(false)} aria-current={active?'page':undefined}>{label}</Link>;
          })}
        </section>)}
      </nav>
      <div className="sidebar-account"><strong>{admin.name}</strong><p>{admin.email}</p><LogoutButton/></div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-header"><button className="btn mobile-menu" aria-label="Open Superadmin navigation" aria-controls="owner-navigation" aria-expanded={open} onClick={()=>setOpen(!open)}>☰</button><span>Fetch Superadmin Console</span><Link className="btn" href="/dashboard/security">Confirm password</Link></header>
      <main className="admin-main">{children}</main>
      <footer className="admin-footer">Superadmin access · Actions recorded under your own account</footer>
    </div>
  </div>;
}
