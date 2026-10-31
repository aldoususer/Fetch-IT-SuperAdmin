import {NextRequest, NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {db} from './db';
import {currentOwner, digest, ownerConfig} from './owner-auth';
import {OwnerError} from './owner-http';
import {assertRuntimeAccess} from './runtime-access';
import {clientAddress, limitRequests, RateLimitError, safeErrorCode} from './request-guard';
import {hashOwnerPassword, validateOwnerPassword, verifyOwnerPassword} from './owner-password';

const noStore = {'Cache-Control': 'private, no-store'};
const invalidLogin = () => new OwnerError('Email or password is incorrect.', 401);
export async function ownerPasswordRoute(req: NextRequest, forcedAction?: 'login') {
  try {
    const config = ownerConfig();
    if (req.headers.get('origin') !== config.origin) throw new OwnerError('This request is not allowed.', 403);
    await assertRuntimeAccess('owner');
    await limitRequests('owner:password-ip', clientAddress(req), 40, 15 * 60_000);
    const rawBody = await req.text();
    if (rawBody.length > 8192) throw new OwnerError('Request is too large.', 413);
    let body;
    try { body = JSON.parse(rawBody); } catch { throw new OwnerError('Enter valid sign-in details.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new OwnerError('Enter valid sign-in details.');
    const action = forcedAction || body.action;
    if (!['login', 'setup', 'confirm', 'change-password'].includes(action)) throw new OwnerError('Unknown sign-in action.');
    const password = body.password;
    if (typeof password !== 'string' || password.length > 128 || !password.length) throw invalidLogin();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    let current: Awaited<ReturnType<typeof currentOwner>> = null;
    if (action === 'confirm' || action === 'change-password') {
      current = await currentOwner();
      if (!current) throw new OwnerError('Sign in again before continuing.', 401);
    } else if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      throw invalidLogin();
    }
    await limitRequests('owner:password-account:' + action, current?.id || email, 10, 15 * 60_000);
    if (action === 'setup') {
      if (!validateOwnerPassword(password)) throw new OwnerError('Use a password of 15–128 characters.');
      if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) throw new OwnerError('A valid password setup code is required.', 403);
      const invitationId = digest(body.token);
      const invitation = await db.ownerInvitation.findFirst({where: {id: invitationId, usedAt: null, expiresAt: {gt: new Date()}, owner: {email, active: true, actor: {role: 'SUPERADMIN', isBanned: false}}}});
      if (!invitation) throw new OwnerError('The password setup code is invalid or expired.', 403);
      const passwordHash = await hashOwnerPassword(password);
      const sessionToken = randomBytes(32).toString('base64url');
      await db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fetch-owner-administration'))`;
        await tx.$queryRaw`SELECT "id" FROM "OwnerIdentity" WHERE "id"=${invitation.ownerId} FOR UPDATE`;
        const owner = await tx.ownerIdentity.findFirst({where: {id: invitation.ownerId, email, active: true, actor: {role: 'SUPERADMIN', isBanned: false}}});
        if (!owner) throw new OwnerError('The password setup code is invalid or expired.', 403);
        const used = await tx.ownerInvitation.updateMany({where: {id: invitationId, ownerId: owner.id, usedAt: null, expiresAt: {gt: new Date()}}, data: {usedAt: new Date()}});
        if (!used.count) throw new OwnerError('The password setup code is invalid or expired.', 403);
        await tx.ownerIdentity.update({where: {id: owner.id}, data: {passwordHash, passwordChangedAt: new Date()}});
        await tx.ownerInvitation.updateMany({where: {ownerId: owner.id, usedAt: null}, data: {usedAt: new Date()}});
        await tx.ownerSession.updateMany({where: {ownerId: owner.id, revokedAt: null}, data: {revokedAt: new Date()}});
        await tx.ownerChallenge.deleteMany({where: {ownerId: owner.id}});
        await tx.ownerSession.create({data: {id: digest(sessionToken), ownerId: owner.id, expiresAt: new Date(Date.now() + 60 * 60_000)}});
        await tx.ownerAudit.create({data: {actorId: owner.id, actorName: owner.name, action: owner.passwordHash ? 'OWNER_PASSWORD_RESET' : 'OWNER_PASSWORD_SET', entityId: owner.id, details: {method: 'Approved password setup', sessionsRevoked: true}}});
      }, {timeout: 20000});
      const response = NextResponse.json({ok: true, redirect: '/dashboard'}, {headers: noStore});
      response.cookies.set(config.cookie, sessionToken, {httpOnly: true, secure: config.secure, sameSite: 'strict', path: '/', maxAge: 3600});
      return response;
    }

    const candidate = await db.ownerIdentity.findFirst({where: {active: true, ...(current ? {id: current.id} : {email}), actor: {role: 'SUPERADMIN', isBanned: false}}});
    const verified = await verifyOwnerPassword(password, candidate?.passwordHash);
    if (!verified || !candidate) throw invalidLogin();
    if (action === 'change-password' && !validateOwnerPassword(body.newPassword)) throw new OwnerError('Use a new password of 15–128 characters.');
    if (action === 'change-password' && password === body.newPassword) throw new OwnerError('Choose a different new password.');
    const nextHash = action === 'change-password' ? await hashOwnerPassword(body.newPassword) : null;
    const sessionToken = randomBytes(32).toString('base64url');
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "OwnerIdentity" WHERE "id"=${candidate.id} FOR UPDATE`;
      const owner = await tx.ownerIdentity.findFirst({where: {id: candidate.id, active: true, passwordHash: candidate.passwordHash, actor: {role: 'SUPERADMIN', isBanned: false}}});
      if (!owner) throw invalidLogin();
      const now = new Date();
      if (current) {
        const session = await tx.ownerSession.updateMany({where: {id: current.sessionId, ownerId: owner.id, revokedAt: null, expiresAt: {gt: now}, lastSeenAt: {gt: new Date(now.getTime() - 15 * 60_000)}}, data: {verifiedAt: now}});
        if (!session.count) throw new OwnerError('Sign in again before continuing.', 401);
      }
      if (nextHash) {
        await tx.ownerIdentity.update({where: {id: owner.id}, data: {passwordHash: nextHash, passwordChangedAt: now}});
        await tx.ownerSession.updateMany({where: {ownerId: owner.id, revokedAt: null}, data: {revokedAt: now}});
        await tx.ownerInvitation.updateMany({where: {ownerId: owner.id, usedAt: null}, data: {usedAt: now}});
      }
      if (action !== 'confirm') await tx.ownerSession.create({data: {id: digest(sessionToken), ownerId: owner.id, expiresAt: new Date(Date.now() + 60 * 60_000)}});
      await tx.ownerAudit.create({data: {actorId: owner.id, actorName: owner.name, action: action === 'confirm' ? 'OWNER_PASSWORD_CONFIRMED' : nextHash ? 'OWNER_PASSWORD_CHANGED' : 'OWNER_PASSWORD_SIGN_IN', entityId: owner.id, details: {method: 'Email and password', sessionsRevoked: !!nextHash}}});
    }, {timeout: 20000});
    const response = NextResponse.json({ok: true, ...(action !== 'confirm' ? {redirect: '/dashboard'} : {message: 'Identity verified. You can continue.'})}, {headers: noStore});
    if (action !== 'confirm') response.cookies.set(config.cookie, sessionToken, {httpOnly: true, secure: config.secure, sameSite: 'strict', path: '/', maxAge: 3600});
    return response;
  } catch (error) {
    if (!(error instanceof OwnerError) && !(error instanceof RateLimitError)) console.error(JSON.stringify({scope: 'owner-password', code: safeErrorCode(error)}));
    return NextResponse.json({error: error instanceof OwnerError || error instanceof RateLimitError ? error.message : 'Sign-in is unavailable. Please try again.'}, {status: error instanceof OwnerError ? error.status : error instanceof RateLimitError ? 429 : 503, headers: {...noStore, ...(error instanceof RateLimitError ? {'Retry-After': String(error.retryAfter)} : {})}});
  }
}
