import {NextRequest,NextResponse} from 'next/server';
import {ownerConfig} from '@/lib/owner-auth';
import {clearAdminSessionCookie} from '@/lib/session';
export async function POST(req:NextRequest){if(req.headers.get('origin')!==ownerConfig().origin)return NextResponse.json({error:'This request is not allowed.'},{status:403});await clearAdminSessionCookie();return NextResponse.json({ok:true});}
