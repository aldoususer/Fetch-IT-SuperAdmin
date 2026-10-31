import {requireStaffPage} from '@/lib/staff-access';
import {currentOwner} from '@/lib/owner-auth';
import {AdminShell} from './admin-shell';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const owner=await requireStaffPage();const session=await currentOwner();return <AdminShell admin={owner} verifiedAt={session?.verifiedAt.getTime()} checkedAt={Date.now()}>{children}</AdminShell>;}
