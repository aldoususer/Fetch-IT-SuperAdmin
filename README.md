# Fetch Superadmin

Dedicated owner console. Owners sign in with approved email/password accounts; staff use the separate Fetch Staff Portal. There is no public owner signup.

## Authentication
- Passwords are stored only in OwnerIdentity, never staff-accessible AuthIdentity. Scrypt uses N=131072, r=8, p=1 with an individual random salt.
- Owner sessions last at most one hour and expire after 15 minutes of inactivity. A password confirmation within five minutes is required before protected changes.
- Same-origin checks, secure HttpOnly SameSite=Strict production cookies, IP/account login limits, and audited owner actions remain enabled.
- Passkey endpoints and user flows are replaced by password sign-in. Existing passkey records are retained but cannot authenticate through this app.
- Initial password setup and forgotten-password recovery require a privately issued, single-use code lasting 30 minutes. The owner chooses their password in /enroll. Normal sign-in uses /login.
- Password changes/reset revoke other sessions and unused setup invitations. Approved owners can invite other owners through Approved owners. Passwords are never emailed or printed.

## Setup and deployment
1. Back up the intended database. Apply migrations once from fetch-customer with an authorized maintenance connection: `npx prisma migrate deploy`.
2. Apply reviewed scripts/setup-runtime-roles.sql once, then provision a distinct restricted owner login. Do not give runtime credentials database ownership, neon_superuser, CREATEROLE, CREATEDB or BYPASSRLS.
3. Configure DATABASE_URL with that restricted owner login, an independent random SESSION_SECRET (at least 32 characters), and exact HTTPS SUPERADMIN_URL. No public-prefixed variables may contain secrets.
4. With Node 22 or newer, run `npm ci` and `npm run build`.
5. First owner only: set OWNER_MAINTENANCE_DATABASE_URL in an authorized terminal and run `npm run bootstrap-owner -- create owner@example.com "Owner Name"`. Subsequent owners are invited from the owner console.
6. Open /enroll and enter the approved email, private setup code and a unique password of 15–128 characters. Future sign-ins need email and password only.
7. Forgotten password or expired setup code: authorized maintenance can run `npm run bootstrap-owner -- recover owner@example.com`. This issues a fresh code, consumes previous unused invitations, revokes owner sessions and records recovery in the audit. Existing password remains usable until replaced.
8. Never store maintenance credentials in Vercel runtime variables. Deploy Superadmin separately from the Staff Portal, then verify the complete flow with restricted credentials.

## Platform capabilities
Owner permissions include staff account/role management, platform settings and audit history, plus the operational views available to Admin. Finance remains simulated accounting; there are no bank transfers. Quote/settings integration and the revised staff permissions require their respective customer/rider/staff deployments.

The shared schema and helpers are maintained in fetch-customer; run `node scripts/sync-shared.cjs --check` there. App-specific owner authentication and request guards remain separate.

## Verification
`npm run build` generates Prisma and checks the production build. The opt-in `tests/owner-password.integration.cjs` script targets only the explicitly verified superadmin-test database, uses disposable owners, and disables its fixtures on completion. It never applies migrations or targets production.
