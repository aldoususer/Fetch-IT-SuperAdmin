import {requireStaffPage} from '@/lib/staff-access';
import {AdminShell} from './admin-shell';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const owner=await requireStaffPage();return <AdminShell admin={owner}>{children}</AdminShell>;}
