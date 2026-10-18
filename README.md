# Fetch Superadmin

Separate owner console for the Fetch platform. Staff use `fetch-admin` (Fetch Staff Portal). Customers and riders keep their existing apps. All apps use the same Neon database, with separate runtime credentials.

## Implemented

- Approved owner enrollment and passkey sign-in. No public signup, owner password, or email-only recovery.
- Owner sessions: one-hour absolute lifetime, 15-minute idle timeout, five-minute verification requirement before mutations, immediate revocation and disabled-account checks.
- Individual staff accounts: Admin, Support Staff, Support Supervisor, Finance Staff and Safety Review Staff; role changes, disable/restore, and session revocation.
- Platform settings: service availability, supported vehicles, fares, surge multipliers, demo commission, offer expiry and reassignment limits. Changes require a reason, compare versions and append an audit record atomically.
- Quote preview. New customer API quotes use saved settings; existing booking prices and commission snapshots stay unchanged.
- Operational booking/customer/rider tools inherited from the staff app, with owner authentication on every protected page and API.
- Support conversations and internal notes, supervisor queue assignments, Finance/Safety reviews, independent Admin approvals, resources and append-only application audit records.
- Voluntary rider offers: expiry returns the job to the available pool. It does not assign the next rider automatically.

Finance records and commission remain **demo accounting**. Approval records a decision; staff must perform any authorized booking/account intervention and record the resolution. This does not connect a real payment provider or execute bank transfers. The existing support inbox accepts customer-originated requests; a rider support submission screen is not included.

## Setup order (before production deployment)

1. Back up the intended database and review the canonical migration in `fetch-customer/prisma/migrations/202610170001_staff_owner_platform/`.
2. Using a maintenance credential, run the customer repository's `npx prisma migrate deploy`. Run migrations once from that repository; do not run them from every app.
3. Review and apply `scripts/setup-runtime-roles.sql` against the intended database using an authorized maintenance session. It creates NOLOGIN permission groups, explicit grants, and User row policies. Configure separate LOGIN principals/passwords that inherit only their corresponding group. Never give runtime principals ownership, `neon_superuser`, `BYPASSRLS`, `CREATEROLE`, or `CREATEDB`. Review preexisting grants/memberships too.
4. Set each app's `DATABASE_URL` to its restricted principal. Staff and owner apps reject overly broad database credentials in production. Use a direct maintenance connection for migrations, not the runtime URL.
5. Copy `.env.example` to `.env.local` and set the owner's restricted `DATABASE_URL`, an independent random `SESSION_SECRET` of at least 32 characters, exact `SUPERADMIN_URL`, and exact hostname `SUPERADMIN_RP_ID`. Use a stable dedicated HTTPS hostname in production; passkeys are bound to that hostname. Local development supports `http://localhost:3003`.
6. Install with Node 22 or newer: `npm ci` (generates Prisma Client).
7. Bootstrap the first approved owner from an authorized local terminal. Set `OWNER_MAINTENANCE_DATABASE_URL` only in that terminal, then run `npm run bootstrap-owner -- create owner@example.com "Owner Name"`. Do not put the maintenance URL in Vercel/runtime environment variables.
8. Start `npm run dev`, open `/enroll`, paste the printed one-time token (30 minutes), and register a passkey with device verification. Add a spare passkey from Security & Sessions. Never commit enrollment tokens or paste them into support messages.
9. In production, deploy the staff and owner projects separately after schema/credential setup. Use a different staff `ADMIN_SESSION_SECRET`. Do not share customer/rider/staff/owner secrets.

The database permission groups share operational tables within the staff app. Per-staff-role visibility is enforced by server authorization and scoped queries. The separate owner credential additionally enforces the owner/staff boundary in PostgreSQL. A Vercel project or hostname by itself does not create that boundary.

## Recovery

Use the spare passkey first. If every key is lost, an authorized maintenance operator can run `npm run bootstrap-owner -- recover owner@example.com`. This revokes that owner's sessions and outstanding enrollment tokens, writes an audit entry and issues a fresh enrollment token. It does not silently delete existing keys. After recovery, register a spare key and remove compromised keys through Security & Sessions. Normal staff credentials cannot run this flow through the application.

## Development and verification

- `npm run dev`: localhost:3003.
- `npm run build`: Prisma generation and production build.
- `npx tsc --noEmit`: type check.
- Staff/owner integration suite: from `fetch-admin`, set `RUN_STAFF_OWNER_INTEGRATION=1` and run `node tests/staff-owner.integration.cjs`. It uses the configured maintenance-capable development DATABASE_URL to create a random `fetch_roles_test_*` schema, run migrations, seed disposable accounts, exercise both local servers, then drop only that test schema. Never run a test using a restricted production runtime credential.
- Canonical shared schema, pricing and policy helpers live in `fetch-customer`. Run `node scripts/sync-shared.cjs` there after shared changes, and commit generated copies with each independent app. Owner-specific request/session/auth guards must remain separate.

No live database migration, production credential provisioning or Vercel deployment is performed just by adding this code.
