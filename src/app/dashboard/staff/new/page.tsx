import Link from 'next/link';
import {requireStaffPage} from '@/lib/staff-access';
import {StaffAccessForm} from '@/components/staff-access-form';
export default async function Page(){
 await requireStaffPage('operations');
 return <div><Link href="/dashboard/staff">← Back to staff</Link><h1>Add staff member</h1><p>Use a separate account for each person so their actions can be traced.</p><StaffAccessForm/></div>;
}
