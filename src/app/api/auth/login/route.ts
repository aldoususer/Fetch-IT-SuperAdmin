import {NextRequest} from 'next/server';
import {ownerPasswordRoute} from '@/lib/owner-password-auth';
export async function POST(req: NextRequest) { return ownerPasswordRoute(req, 'login'); }
