import {redirect} from 'next/navigation';
import {currentOwner} from './owner-auth';
import {hasPermission, type Permission} from './staff-policy';
import type {UserRole} from '@prisma/client';
export async function currentStaff(permission?:Permission){const owner=await currentOwner();if(!owner||(permission&&!hasPermission('SUPERADMIN',permission)))return null;return {id:owner.actorId,name:owner.name,email:owner.email,role:'SUPERADMIN' as UserRole,isBanned:false,authInvalidBefore:null};}
export async function requireStaffPage(permission?:Permission){const owner=await currentStaff(permission);if(!owner)redirect('/login');return owner;}
