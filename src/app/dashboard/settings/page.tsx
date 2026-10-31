import {requireStaffPage} from '@/lib/staff-access';
import {platformSettings} from '@/lib/platform-settings';
import {SettingsForm} from '@/components/settings-form';
export default async function Page(){await requireStaffPage();const{version,settings}=await platformSettings();return <div><div className="eyebrow">PLATFORM CONFIGURATION · VERSION {version}</div><h1>Pricing & rules</h1><p>Changes affect new booking requests. Pausing a service does not stop active jobs. Manual offers always require rider acceptance.</p><SettingsForm initial={settings} version={version}/></div>;}
