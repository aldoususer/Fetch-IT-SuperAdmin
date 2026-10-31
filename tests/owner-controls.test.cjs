// Credential-free regressions for owner restriction gates and payment audit roles.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');
const origin = 'https://owner-regression.example.invalid';

function load(file, overrides = new Map(), cache = new Map()) {
  const filename = path.resolve(root, file);
  if (overrides.has(filename)) return overrides.get(filename);
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, process, Buffer, URL,
    console: { info() {}, warn() {}, error() {} },
    require(name) {
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load(name.replace('@/', 'src/') + '.ts', overrides, cache);
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name + '.ts'), overrides, cache);
      return require(name);
    },
  }, { filename });
  return exports;
}

function restrictionFixture({ role = 'CUSTOMER', banned = false, signedIn = true, fresh = true } = {}) {
  const user = { id: 'subject', name: 'QA participant', role, isBanned: banned, banReason: banned ? 'Previous restriction' : null, bannedAt: null };
  const audits = [], proofRequests = [];
  const db = {
    user: {
      async findUnique({ where }) { return where.id === user.id ? { ...user } : null; },
      async updateMany({ where, data }) {
        if (where.id !== user.id || !where.role.in.includes(user.role) || where.isBanned !== user.isBanned) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      },
    },
    adminAudit: { async create({ data }) { audits.push(data); return data; } },
    async $transaction(fn) { return fn(db); },
  };
  const overrides = new Map([
    [path.join(root, 'src/lib/db.ts'), { db }],
    [path.join(root, 'src/lib/owner-auth.ts'), {
      ownerConfig: () => ({ origin }),
      currentOwner: async requireFresh => {
        proofRequests.push(requireFresh);
        return signedIn && (!requireFresh || fresh) ? { id: 'owner', name: 'QA owner' } : null;
      },
    }],
    [path.join(root, 'src/lib/admin-access.ts'), {
      currentAdmin: async () => signedIn ? { id: 'actor', name: 'QA owner', role: 'SUPERADMIN' } : null,
    }],
    [path.join(root, 'src/lib/push-delivery.ts'), { schedulePushDelivery() {} }],
  ]);
  const route = load('src/app/api/users/[id]/route.ts', overrides);
  return {
    user, audits, proofRequests,
    async request(action, { requestOrigin = origin, fetchSite, reason = 'QA verified reason', id = user.id } = {}) {
      const headers = { 'Content-Type': 'application/json' };
      if (requestOrigin !== undefined && requestOrigin !== null) headers.origin = requestOrigin;
      if (fetchSite) headers['sec-fetch-site'] = fetchSite;
      return route.PATCH(new NextRequest(origin + '/api/users/' + id, {
        method: 'PATCH', headers, body: JSON.stringify({ action, ...(reason === undefined ? {} : { reason }) }),
      }), { params: Promise.resolve({ id }) });
    },
  };
}

const gateCases = [
  ['fresh owner and matching origin', {}, {}, 200],
  ['stale password confirmation', { fresh: false }, {}, 401],
  ['no owner session', { signedIn: false }, {}, 401],
  ['foreign origin', {}, { requestOrigin: 'https://foreign.example.invalid' }, 401],
  ['missing origin', {}, { requestOrigin: null }, 401],
  ['opaque null origin', {}, { requestOrigin: 'null' }, 401],
  ['origin with a trusted-looking prefix', {}, { requestOrigin: origin + '.attacker.invalid' }, 401],
  ['cross-site fetch metadata', {}, { fetchSite: 'cross-site' }, 403],
];
for (const role of ['CUSTOMER', 'RIDER']) {
  for (const action of ['ban', 'unban']) {
    for (const [name, state, input, expected] of gateCases) {
      test(role + ' ' + action + ': ' + name, async () => {
        const before = action === 'unban';
        const f = restrictionFixture({ role, banned: before, ...state });
        const response = await f.request(action, input);
        assert.equal(response.status, expected);
        if (expected === 200) {
          assert.equal(f.user.isBanned, !before);
          assert.equal(f.audits.length, 1);
          assert(f.proofRequests.includes(true), 'Mutation must request recent owner proof');
          assert.equal(f.audits[0].actorId, 'actor');
          assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
          assert(response.headers.get('X-Request-ID'));
        } else {
          assert.equal(f.user.isBanned, before, 'A rejected request must not change restrictions');
          assert.equal(f.audits.length, 0, 'A rejected request must not create an intervention audit');
        }
      });
    }
  }
}
test('restriction validation and missing/protected records preserve their responses', async () => {
  const f = restrictionFixture();
  assert.equal((await f.request('ban', { reason: '' })).status, 400);
  assert.equal((await f.request('ban', { reason: 'x'.repeat(501) })).status, 400);
  assert.equal((await f.request('unsupported')).status, 400);
  assert.equal((await f.request('ban', { id: 'missing' })).status, 404);
  assert.equal(f.user.isBanned, false);
  assert.equal(f.audits.length, 0);
  const admin = restrictionFixture({ role: 'ADMIN' });
  assert.equal((await admin.request('ban')).status, 403);
  assert.equal(admin.audits.length, 0);
});
test('a duplicate restriction remains a conflict without duplicate audit entries', async () => {
  const f = restrictionFixture();
  assert.equal((await f.request('ban')).status, 200);
  assert.equal((await f.request('ban')).status, 409);
  assert.equal(f.audits.length, 1);
});

function paymentFixture(method = 'CASH', paymentStatus = 'UNPAID') {
  const row = {
    id: 'booking', refCode: 'QA-BOOKING', customerId: 'customer', riderId: 'rider',
    paymentMethod: method, paymentStatus, status: 'DELIVERED',
    totalFare: { toString: () => '100.00' }, paymentReference: null, paidAt: null,
    demoCommissionBps: 1500, demoCommission: 15, demoRiderEarnings: 85, demoPayoutAt: null,
  };
  const events = [], audits = [];
  const db = {
    async $queryRaw() { return []; },
    booking: {
      async findUnique() { return row; },
      async update({ data }) { Object.assign(row, data); return row; },
    },
    demoCheckout: { async updateMany() { return { count: 0 }; } },
    paymentEvent: { async create({ data }) { events.push(data); return data; } },
    adminAudit: { async create({ data }) { audits.push(data); return data; } },
    async $transaction(fn) { return fn(db); },
  };
  return { db, row, events, audits };
}
const { reviewPayment } = load('src/lib/payments.ts');
const { recordDemoPayout, cancelDemoPayment } = load('src/lib/demo-payments.ts');
function actor(role) { return { uid: 'actor-' + role, name: 'QA ' + role, role }; }
function assertActor(event, identity) {
  assert.equal(event.actorId, identity.uid);
  assert.equal(event.actorName, identity.name);
  assert.equal(event.actorRole, identity.role);
}

for (const role of ['ADMIN', 'SUPERADMIN']) {
  test(role + ' cash payment review records the real actor role', async () => {
    const f = paymentFixture(), identity = actor(role);
    await reviewPayment(f.db, f.row.id, identity, { status: 'PAID', reason: 'QA cash evidence' });
    assert.equal(f.row.paymentStatus, 'PAID');
    assert.equal(f.events.length, 1);
    assertActor(f.events[0], identity);
    assert.equal(f.events[0].action, 'ADMIN_REVIEWED');
    assert.equal(f.audits.length, 1);
    await reviewPayment(f.db, f.row.id, identity, { status: 'PAID', reason: 'QA retry' });
    assert.equal(f.events.length, 1, 'A no-op retry must not duplicate history');
  });
  test(role + ' completed demo refund records the real actor role', async () => {
    const f = paymentFixture('DEMO_GCASH', 'PAID'), identity = actor(role);
    await reviewPayment(f.db, f.row.id, identity, { status: 'REFUNDED', reason: 'QA test refund' });
    assert.equal(f.row.paymentStatus, 'REFUNDED');
    assert.equal(f.row.demoCommission, null);
    assert.equal(f.row.demoRiderEarnings, null);
    assertActor(f.events[0], identity);
    assert.equal(f.events[0].action, 'DEMO_REFUND_RECORDED');
  });
  test(role + ' demo payout records the real actor role and stays idempotent', async () => {
    const f = paymentFixture('DEMO_MAYA', 'PAID'), identity = actor(role);
    const input = { reference: 'QA-PAYOUT', reason: 'QA simulated payout' };
    await recordDemoPayout(f.db, f.row.id, identity, input);
    assert(f.row.demoPayoutAt);
    assert.equal(f.row.demoPayoutReference, 'DEMO-QA-PAYOUT');
    assertActor(f.events[0], identity);
    assert.equal(f.events[0].action, 'DEMO_PAYOUT_RECORDED');
    await recordDemoPayout(f.db, f.row.id, identity, input);
    assert.equal(f.events.length, 1);
    await assert.rejects(recordDemoPayout(f.db, f.row.id, identity, { ...input, reference: 'OTHER' }), /already recorded/);
  });
  test(role + ' cancellation refund keeps its existing actor role', async () => {
    const f = paymentFixture('DEMO_BANK', 'PAID'), identity = actor(role);
    await cancelDemoPayment(f.db, { ...f.row }, identity);
    assert.equal(f.row.paymentStatus, 'REFUNDED');
    assertActor(f.events[0], identity);
  });
}
for (const role of ['CUSTOMER', 'RIDER']) {
  test(role + ' cannot review payments or record payouts', async () => {
    const f = paymentFixture('DEMO_GCASH', 'PAID');
    await assert.rejects(reviewPayment(f.db, f.row.id, actor(role), { status: 'REFUNDED', reason: 'QA forbidden' }), /Admin account required/);
    await assert.rejects(recordDemoPayout(f.db, f.row.id, actor(role), { reference: 'QA', reason: 'QA forbidden' }), /Admin account required/);
    assert.equal(f.events.length, 0);
    assert.equal(f.audits.length, 0);
    assert.equal(f.row.paymentStatus, 'PAID');
  });
}

for(const action of ['ban','unban'])test(action+' requires an attributable reason and keeps the audit result readable',async()=>{
 for(const reason of ['', ' ', 'x'.repeat(501), null]){const f=restrictionFixture({banned:action==='unban'});assert.equal((await f.request(action,{reason})).status,400);assert.equal(f.audits.length,0);}
 const f=restrictionFixture({banned:action==='unban'});const response=await f.request(action,{reason:'Reviewed local evidence'});assert.equal(response.status,200);assert((await response.json()).message);assert.equal(f.audits[0].details.reason,'Reviewed local evidence');assert.equal(f.audits[0].details.before.isBanned,action==='unban');assert.equal(f.audits[0].details.after.isBanned,action==='ban');
});
