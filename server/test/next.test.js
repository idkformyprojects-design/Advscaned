import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../db.js';
import { createApp } from '../app.js';

const KEY_SECRET = 'rzp_test_secret';
const WEBHOOK_SECRET = 'whsec_test';
const sign = (secret, data) => createHmac('sha256', secret).update(data).digest('hex');

let server, base, db, app, uploads;
let orderSeq = 0;

before(async () => {
  uploads = mkdtempSync(join(tmpdir(), 'bazaar-next-'));
  db = openDb(':memory:');
  app = createApp({
    db,
    devOtpCode: '1234',
    uploadsDir: uploads,
    demoReplyMs: false,
    adminPhones: ['+919000000001'],
    payments: {
      keyId: 'rzp_test_key',
      keySecret: KEY_SECRET,
      webhookSecret: WEBHOOK_SECRET,
      // Stand-in for https://api.razorpay.com/v1/orders
      createOrder: async (amount) => ({ id: `order_${++orderSeq}`, amount, currency: 'INR' }),
    },
  });
  server = createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  app.close();
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(uploads, { recursive: true, force: true });
});

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

let phoneSeq = 100;
async function signIn(name, phone = `98300${String(++phoneSeq).padStart(5, '0')}`) {
  await call('POST', '/api/auth/otp', { body: { phone } });
  const v = await call('POST', '/api/auth/verify', { body: { phone, code: '1234', name } });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return v.data;
}

async function postAd(token, title = 'Wooden bookshelf, 5 rows') {
  const r = await call('POST', '/api/ads', {
    token,
    body: { title, price: 2500, category: 'furniture', condition: 'good', area: 'Behala' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.ad;
}

/** Reads a server-sent-event stream until `event` arrives (or times out). */
async function waitForEvent(res, event, ms = 3000) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const deadline = Date.now() + ms;
  try {
    while (Date.now() < deadline) {
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise((r) => setTimeout(() => r({ timeout: true }), deadline - Date.now())),
      ]);
      if (done || !value) break;
      buf += dec.decode(value, { stream: true });
      if (buf.includes(`event: ${event}\n`)) return buf;
    }
    return null;
  } finally {
    reader.cancel().catch(() => {});
  }
}

describe('live updates', () => {
  test('stream needs a valid session', async () => {
    const r = await fetch(`${base}/api/stream?token=nope`);
    assert.equal(r.status, 401);
    await r.body?.cancel();
  });

  test('a new message is pushed to the other person instantly', async () => {
    const seller = await signIn('Sana Seller');
    const buyer = await signIn('Bilal Buyer');
    const ad = await postAd(seller.token);

    const stream = await fetch(`${base}/api/stream?token=${seller.token}`);
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get('content-type'), /text\/event-stream/);

    const chat = await call('POST', '/api/chats', { token: buyer.token, body: { adId: ad.id } });
    const pending = waitForEvent(stream, 'update');
    await call('POST', `/api/chats/${chat.data.chat.id}/messages`, {
      token: buyer.token,
      body: { text: 'Still available?' },
    });
    const got = await pending;
    assert.ok(got, 'seller received an update event');
    assert.match(got, /"type":"chat"/);
  });
});

describe('paid boosts (Razorpay)', () => {
  let seller, ad;

  before(async () => {
    seller = await signIn('Priti Payer');
    ad = await postAd(seller.token, 'Study lamp with warm light');
  });

  test('bootstrap advertises payments and the price', async () => {
    const boot = await call('GET', '/api/bootstrap', { token: seller.token });
    assert.deepEqual(boot.data.config, { payments: true, boostPricePaise: 14900, boostDays: 7 });
  });

  test('free boost is refused once payments are on', async () => {
    const r = await call('POST', `/api/ads/${ad.id}/boost`, { token: seller.token });
    assert.equal(r.status, 402);
  });

  test('order → wrong signature is rejected → right signature boosts', async () => {
    const order = await call('POST', `/api/ads/${ad.id}/boost/order`, { token: seller.token });
    assert.equal(order.status, 200, JSON.stringify(order.data));
    assert.equal(order.data.amount, 14900);
    assert.equal(order.data.keyId, 'rzp_test_key');

    const bad = await call('POST', '/api/payments/verify', {
      token: seller.token,
      body: { orderId: order.data.orderId, paymentId: 'pay_1', signature: 'f'.repeat(64) },
    });
    assert.equal(bad.status, 400);

    const signature = sign(KEY_SECRET, `${order.data.orderId}|pay_1`);
    const ok = await call('POST', '/api/payments/verify', {
      token: seller.token,
      body: { orderId: order.data.orderId, paymentId: 'pay_1', signature },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.ad.boosted, true);
    const days = (ok.data.ad.boostedUntil - Date.now()) / 86_400_000;
    assert.ok(days > 6.9 && days <= 7, `boost lasts 7 days (got ${days})`);

    const again = await call('POST', '/api/payments/verify', {
      token: seller.token,
      body: { orderId: order.data.orderId, paymentId: 'pay_1', signature },
    });
    assert.equal(again.data.ad.boostedUntil, ok.data.ad.boostedUntil, 'verifying twice is a no-op');
  });

  test("someone else can't verify your order", async () => {
    const order = await call('POST', `/api/ads/${ad.id}/boost/order`, { token: seller.token });
    const other = await signIn('Mallory');
    const r = await call('POST', '/api/payments/verify', {
      token: other.token,
      body: {
        orderId: order.data.orderId,
        paymentId: 'pay_x',
        signature: sign(KEY_SECRET, `${order.data.orderId}|pay_x`),
      },
    });
    assert.equal(r.status, 404);
  });

  test('webhook completes a payment even if the app never verified', async () => {
    const order = await call('POST', `/api/ads/${ad.id}/boost/order`, { token: seller.token });
    const before = (await call('GET', `/api/ads/${ad.id}`)).data.ad.boostedUntil;
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh', order_id: order.data.orderId } } },
    });
    const forged = await call('POST', '/api/payments/webhook', {
      body: payload,
      headers: { 'X-Razorpay-Signature': 'nope' },
    });
    assert.equal(forged.status, 400);
    const r = await call('POST', '/api/payments/webhook', {
      body: payload,
      headers: { 'X-Razorpay-Signature': sign(WEBHOOK_SECRET, payload) },
    });
    assert.equal(r.status, 200);
    const after = (await call('GET', `/api/ads/${ad.id}`)).data.ad.boostedUntil;
    assert.ok(after - before > 6.9 * 86_400_000, 'a second boost extends the first by 7 days');
  });

  test('boosts expire', async () => {
    db.prepare('UPDATE ads SET boosted_until = ? WHERE id = ?').run(Date.now() - 1000, ad.id);
    const r = await call('GET', `/api/ads/${ad.id}`);
    assert.equal(r.data.ad.boosted, false);
  });
});

describe('moderation', () => {
  let admin, owner, ad;

  before(async () => {
    admin = await signIn('Asha Admin', '9000000001');
    owner = await signIn('Oscar Owner');
    ad = await postAd(owner.token, 'Suspiciously cheap iPhone 15');
  });

  test('admins are recognised; others are kept out', async () => {
    assert.equal(admin.user.role, 'admin');
    assert.equal(owner.user.role, 'user');
    assert.equal((await call('GET', '/api/admin/reports', { token: owner.token })).status, 403);
    assert.equal((await call('GET', '/api/admin/stats', { token: admin.token })).status, 200);
  });

  test('three reports hide an ad for review', async () => {
    for (let i = 0; i < 3; i++) {
      const u = await signIn(`Reporter ${i}`);
      await call('POST', '/api/reports', {
        token: u.token,
        body: { targetType: 'ad', targetId: ad.id, reason: 'Suspected scam' },
      });
    }
    const mine = (await call('GET', `/api/ads/${ad.id}`, { token: owner.token })).data.ad;
    assert.equal(mine.status, 'pending');
    assert.equal((await call('GET', `/api/ads/${ad.id}`)).status, 404, 'hidden from the public');
    const search = await call('GET', '/api/ads?q=suspiciously');
    assert.equal(search.data.ads.length, 0);
    const edit = await call('PATCH', `/api/ads/${ad.id}`, {
      token: owner.token,
      body: { status: 'active' },
    });
    assert.equal(edit.status, 423, "owner can't republish while under review");
  });

  test('admin queue shows the report with its target', async () => {
    const q = await call('GET', '/api/admin/reports', { token: admin.token });
    const r = q.data.reports.find((x) => x.targetId === ad.id);
    assert.ok(r);
    assert.equal(r.openReportsOnTarget, 3);
    assert.equal(r.target.ad.title, 'Suspiciously cheap iPhone 15');
    assert.equal((await call('GET', '/api/admin/stats', { token: admin.token })).data.underReview, 1);
  });

  test('restore puts the ad back and closes its reports', async () => {
    const q = await call('GET', '/api/admin/reports', { token: admin.token });
    const r = q.data.reports.find((x) => x.targetId === ad.id);
    await call('POST', `/api/admin/reports/${r.id}/resolve`, {
      token: admin.token,
      body: { action: 'restore' },
    });
    assert.equal((await call('GET', `/api/ads/${ad.id}`)).data.ad.status, 'active');
    const open = await call('GET', '/api/admin/reports', { token: admin.token });
    assert.ok(!open.data.reports.some((x) => x.targetId === ad.id));
    const resolved = await call('GET', '/api/admin/reports?status=resolved', { token: admin.token });
    assert.ok(resolved.data.reports.some((x) => x.targetId === ad.id && x.resolution === 'restored'));
  });

  test('remove takes an ad down for good', async () => {
    const reporter = await signIn('Another reporter');
    await call('POST', '/api/reports', {
      token: reporter.token,
      body: { targetType: 'ad', targetId: ad.id, reason: 'Fake item' },
    });
    const r = (await call('GET', '/api/admin/reports', { token: admin.token })).data.reports.find(
      (x) => x.targetId === ad.id,
    );
    await call('POST', `/api/admin/reports/${r.id}/resolve`, {
      token: admin.token,
      body: { action: 'remove' },
    });
    const mine = (await call('GET', `/api/ads/${ad.id}`, { token: owner.token })).data.ad;
    assert.equal(mine.status, 'removed');
    const boot = await call('GET', '/api/bootstrap', { token: owner.token });
    assert.ok(boot.data.notifications.some((n) => n.title === 'Your ad was removed'));
  });

  test('ban signs the seller out everywhere and removes their ads', async () => {
    const spammer = await signIn('Spammy Sam');
    const spamAd = await postAd(spammer.token, 'Earn ₹50,000 a week from home');
    const reporter = await signIn('Careful Carol');
    await call('POST', '/api/reports', {
      token: reporter.token,
      body: { targetType: 'seller', targetId: spammer.user.id, reason: 'Asked for advance payment' },
    });
    const r = (await call('GET', '/api/admin/reports', { token: admin.token })).data.reports.find(
      (x) => x.targetId === spammer.user.id,
    );
    assert.equal(r.target.seller.name, 'Spammy Sam');
    const res = await call('POST', `/api/admin/reports/${r.id}/resolve`, {
      token: admin.token,
      body: { action: 'ban' },
    });
    assert.equal(res.data.target.seller.banned, true);

    assert.equal((await call('GET', '/api/me', { token: spammer.token })).status, 401);
    assert.equal((await call('GET', `/api/ads/${spamAd.id}`)).status, 404);
    await call('POST', '/api/auth/otp', { body: { phone: spammer.user.phone } });
    const login = await call('POST', '/api/auth/verify', {
      body: { phone: spammer.user.phone, code: '1234' },
    });
    assert.equal(login.status, 403, 'banned accounts cannot sign back in');

    await call('POST', `/api/admin/users/${spammer.user.id}/unban`, { token: admin.token });
    await call('POST', '/api/auth/otp', { body: { phone: spammer.user.phone } });
    const back = await call('POST', '/api/auth/verify', {
      body: { phone: spammer.user.phone, code: '1234' },
    });
    assert.equal(back.status, 200, 'unbanned accounts can sign in again');
  });

  test("admins can't ban each other", async () => {
    const reporter = await signIn('Petty Pete');
    await call('POST', '/api/reports', {
      token: reporter.token,
      body: { targetType: 'seller', targetId: admin.user.id, reason: 'Rude moderator' },
    });
    const r = (await call('GET', '/api/admin/reports', { token: admin.token })).data.reports.find(
      (x) => x.targetId === admin.user.id,
    );
    const res = await call('POST', `/api/admin/reports/${r.id}/resolve`, {
      token: admin.token,
      body: { action: 'ban' },
    });
    assert.equal(res.status, 400);
  });
});
