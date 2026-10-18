import {redirect} from 'next/navigation';
import {currentOwner} from './owner-auth';
import type {Permission} from './staff-policy';
import type {UserRole} from '@prisma/client';
export async function currentStaff(_permission?:Permission){const owner=await currentOwner();return owner?{id:owner.actorId,name:owner.name,email:owner.email,role:'SUPERADMIN' as UserRole,isBanned:false,authInvalidBefore:null}:null;}
export async function requireStaffPage(permission?:Permission){const owner=await currentStaff(permission);if(!owner)redirect('/login');return owner;}
