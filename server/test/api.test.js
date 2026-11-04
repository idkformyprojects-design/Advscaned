import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../db.js';
import { createApp, normalizePhone } from '../app.js';

let server, base, db, app, uploads;
const sms = [];

before(async () => {
  uploads = mkdtempSync(join(tmpdir(), 'bazaar-up-'));
  db = openDb(':memory:');
  app = createApp({
    db,
    otpSecret: 'test',
    sendSms: async (phone, code) => void sms.push({ phone, code }),
    uploadsDir: uploads,
    demoReplyMs: 20,
  });
  server = createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  app.close();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(uploads, { recursive: true, force: true });
});

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function signIn(phone, name) {
  const otp = await call('POST', '/api/auth/otp', { body: { phone } });
  assert.equal(otp.status, 200, JSON.stringify(otp.data));
  const code = sms.filter((s) => s.phone === normalizePhone(phone)).at(-1).code;
  const v = await call('POST', '/api/auth/verify', { body: { phone, code, name } });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return v.data;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Bazaar API', () => {
  let alice, bob, adId;

  test('health and seeded marketplace', async () => {
    assert.equal((await call('GET', '/api/health')).data.ok, true);
    const boot = await call('GET', '/api/bootstrap');
    assert.equal(boot.status, 200);
    assert.equal(boot.data.ads.length, 16);
    assert.ok(boot.data.sellers.find((s) => s.id === 'u1' && s.name === 'Rohan Mehta'));
    assert.equal(boot.data.me, null);
    assert.ok(boot.data.reviews.length >= 6);
  });

  test('phone validation and OTP login', async () => {
    assert.equal(normalizePhone('98300 12345'), '+919830012345');
    assert.equal(normalizePhone('+91 98300 12345'), '+919830012345');
    assert.equal((await call('POST', '/api/auth/otp', { body: { phone: '12345' } })).status, 400);

    await call('POST', '/api/auth/otp', { body: { phone: '9830000001' } });
    const wrong = await call('POST', '/api/auth/verify', {
      body: { phone: '9830000001', code: '0000' },
    });
    // A random 4-digit code is "0000" only 1 in 9000 runs.
    assert.equal(wrong.status, 400);
    const resend = await call('POST', '/api/auth/otp', { body: { phone: '9830000001' } });
    assert.equal(resend.status, 429, 'resend is rate limited');

    alice = await signIn('9830000002', 'Alice Das');
    assert.ok(alice.token.length > 30);
    assert.equal(alice.isNew, true);
    assert.equal(alice.user.name, 'Alice Das');
    bob = await signIn('9830000003', 'Bob Roy');

    const me = await call('GET', '/api/me', { token: alice.token });
    assert.equal(me.data.user.phone, '+91 98300 00002');
    assert.equal((await call('GET', '/api/me')).status, 401);
    assert.equal((await call('GET', '/api/me', { token: 'nope' })).status, 401);

    const renamed = await call('PATCH', '/api/me', { token: alice.token, body: { area: 'Garia' } });
    assert.equal(renamed.data.user.area, 'Garia');
  });

  test('the same phone signs back into the same account', async () => {
    const again = await signIn('9830000002');
    assert.equal(again.isNew, false);
    assert.equal(again.user.id, alice.user.id);
  });

  test('create, validate, edit and publish ads', async () => {
    const tooShort = await call('POST', '/api/ads', {
      token: alice.token,
      body: { title: 'Bike', price: 10, category: 'bikes', condition: 'good', area: 'Garia' },
    });
    assert.equal(tooShort.status, 400);
    assert.match(tooShort.data.error, /title/);

    const unauth = await call('POST', '/api/ads', { body: {} });
    assert.equal(unauth.status, 401);

    const created = await call('POST', '/api/ads', {
      token: alice.token,
      body: {
        id: 'ad-client123',
        title: 'Hero cycle, barely used',
        price: 4500,
        category: 'sports',
        condition: 'good',
        area: 'Garia',
        status: 'draft',
        attributes: { brand: 'Hero' },
        images: ['/images/cycle-giant.jpg'],
      },
    });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    adId = created.data.ad.id;
    assert.equal(adId, 'ad-client123', 'client-generated ids are kept');
    assert.equal(created.data.ad.status, 'draft');
    assert.equal(created.data.ad.sellerId, alice.user.id);

    // Drafts are private.
    assert.equal((await call('GET', `/api/ads/${adId}`)).status, 404);
    assert.equal((await call('GET', `/api/ads/${adId}`, { token: alice.token })).status, 200);

    const notMine = await call('PATCH', `/api/ads/${adId}`, {
      token: bob.token,
      body: { price: 1 },
    });
    assert.equal(notMine.status, 403);

    const live = await call('PATCH', `/api/ads/${adId}`, {
      token: alice.token,
      body: { status: 'active', price: 4200 },
    });
    assert.equal(live.data.ad.status, 'active');
    assert.equal(live.data.ad.price, 4200);
    assert.equal(live.data.ad.priceHistory, undefined, 'editing a draft is not a price drop');

    const search = await call('GET', '/api/ads?q=hero%20cycle');
    assert.ok(search.data.ads.some((a) => a.id === adId));
    const cheap = await call('GET', '/api/ads?cat=sports&max=5000');
    assert.ok(cheap.data.ads.every((a) => a.category === 'sports' && a.price <= 5000));
  });

  test('views, favourites and price-drop notifications', async () => {
    await call('POST', `/api/ads/${adId}/view`, { token: bob.token });
    const v = await call('POST', `/api/ads/${adId}/view`, { token: alice.token });
    assert.equal(v.data.views, 1, "a seller viewing their own ad isn't counted");

    const fav = await call('PUT', `/api/ads/${adId}/favorite`, { token: bob.token });
    assert.equal(fav.data.saves, 1);
    const twice = await call('PUT', `/api/ads/${adId}/favorite`, { token: bob.token });
    assert.equal(twice.data.saves, 1, 'favouriting is idempotent');

    const drop = await call('PATCH', `/api/ads/${adId}`, {
      token: alice.token,
      body: { price: 3800 },
    });
    assert.equal(drop.data.ad.priceHistory.length, 2);

    const boot = await call('GET', '/api/bootstrap', { token: bob.token });
    assert.deepEqual(boot.data.favorites, [adId]);
    assert.ok(boot.data.notifications.some((n) => n.type === 'price' && n.href === `/ad/${adId}`));

    const unfav = await call('DELETE', `/api/ads/${adId}/favorite`, { token: bob.token });
    assert.equal(unfav.data.saves, 0);
  });

  test('boosting', async () => {
    const b = await call('POST', `/api/ads/${adId}/boost`, { token: alice.token });
    assert.equal(b.data.ad.boosted, true);
    assert.equal(b.data.ad.featured, true);
  });

  test('chats between buyer and seller, with offers and read receipts', async () => {
    const self = await call('POST', '/api/chats', { token: alice.token, body: { adId } });
    assert.equal(self.status, 400, "sellers can't message themselves");

    const c = await call('POST', '/api/chats', {
      token: bob.token,
      body: { adId, id: 'chat-bob1' },
    });
    assert.equal(c.data.chat.id, 'chat-bob1');
    assert.equal(c.data.chat.counterpartId, alice.user.id);
    const same = await call('POST', '/api/chats', { token: bob.token, body: { adId } });
    assert.equal(same.data.chat.id, 'chat-bob1', 'one chat per buyer per ad');

    const since = Date.now() - 1;
    const m = await call('POST', '/api/chats/chat-bob1/messages', {
      token: bob.token,
      body: { text: 'Would you take ₹3,500?', kind: 'offer', offerAmount: 3500, id: 'm-bob-1' },
    });
    assert.equal(m.data.message.kind, 'offer');
    assert.equal(m.data.message.offerAmount, 3500);

    const upd = await call('GET', `/api/updates?since=${since}`, { token: alice.token });
    assert.equal(upd.data.chats.length, 1);
    assert.equal(upd.data.chats[0].counterpartId, bob.user.id);
    assert.ok(upd.data.notifications.some((n) => n.title === 'Bob sent an offer'));
    assert.ok(upd.data.sellers.some((s) => s.id === bob.user.id));

    const stranger = await signIn('9830000004', 'Eve');
    assert.equal(
      (
        await call('POST', '/api/chats/chat-bob1/messages', {
          token: stranger.token,
          body: { text: 'hi' },
        })
      ).status,
      404,
      'outsiders cannot read or post',
    );

    await call('POST', '/api/chats/chat-bob1/read', { token: alice.token });
    const bobView = await call('GET', '/api/chats', { token: bob.token });
    assert.equal(bobView.data.chats[0].messages[0].read, true);
  });

  test('seeded demo sellers reply automatically', async () => {
    const c = await call('POST', '/api/chats', { token: bob.token, body: { adId: 'ad-3' } });
    await call('POST', `/api/chats/${c.data.chat.id}/messages`, {
      token: bob.token,
      body: { text: 'Is this available?' },
    });
    await wait(120);
    const chats = await call('GET', '/api/chats', { token: bob.token });
    const chat = chats.data.chats.find((x) => x.id === c.data.chat.id);
    assert.equal(chat.messages.length, 2);
    assert.equal(chat.messages[1].senderId, 'u2');
  });

  test('blocking stops messages and hides ads', async () => {
    await call('PUT', `/api/blocks/${alice.user.id}`, { token: bob.token });
    const blockedMsg = await call('POST', '/api/chats/chat-bob1/messages', {
      token: alice.token,
      body: { text: 'Still there?' },
    });
    assert.equal(blockedMsg.status, 403, 'blocks apply in both directions');
    const ads = await call('GET', '/api/ads?q=hero', { token: bob.token });
    assert.equal(ads.data.ads.length, 0);
    const boot = await call('GET', '/api/bootstrap', { token: bob.token });
    assert.deepEqual(boot.data.blocked, [alice.user.id]);
    await call('DELETE', `/api/blocks/${alice.user.id}`, { token: bob.token });
    assert.equal((await call('GET', '/api/ads?q=hero', { token: bob.token })).data.ads.length, 1);
  });

  test('reviews update the seller rating, once per author', async () => {
    const before = (await call('GET', `/api/sellers/${alice.user.id}`)).data.seller;
    const r = await call('POST', `/api/sellers/${alice.user.id}/reviews`, {
      token: bob.token,
      body: { rating: 4, text: 'Smooth deal, cycle as described.' },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.seller.reviews, before.reviews + 1);
    const dup = await call('POST', `/api/sellers/${alice.user.id}/reviews`, {
      token: bob.token,
      body: { rating: 5, text: 'Second review attempt' },
    });
    assert.equal(dup.status, 409);
    const selfReview = await call('POST', `/api/sellers/${alice.user.id}/reviews`, {
      token: alice.token,
      body: { rating: 5, text: 'I am the best seller' },
    });
    assert.equal(selfReview.status, 400);
  });

  test('reports and notifications', async () => {
    const rep = await call('POST', '/api/reports', {
      token: bob.token,
      body: { targetType: 'ad', targetId: 'ad-1', reason: 'Suspected scam' },
    });
    assert.equal(rep.status, 200);
    await call('POST', '/api/notifications/read', { token: alice.token, body: {} });
    const boot = await call('GET', '/api/bootstrap', { token: alice.token });
    assert.ok(boot.data.notifications.length > 0);
    assert.ok(boot.data.notifications.every((n) => n.read));
  });

  test('image uploads', async () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    assert.equal((await call('POST', '/api/uploads', { body: { dataUrl: png } })).status, 401);
    const bad = await call('POST', '/api/uploads', {
      token: alice.token,
      body: { dataUrl: 'data:text/html;base64,PGI+' },
    });
    assert.equal(bad.status, 400);
    const up = await call('POST', '/api/uploads', { token: alice.token, body: { dataUrl: png } });
    assert.equal(up.status, 200);
    const path = new URL(up.data.url).pathname;
    const img = await fetch(base + path);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.equal((await fetch(base + '/uploads/..%2Fsecret.png')).status, 404);

    const withPhoto = await call('PATCH', `/api/ads/${adId}`, {
      token: alice.token,
      body: { images: [up.data.url] },
    });
    assert.deepEqual(withPhoto.data.ad.images, [up.data.url]);
    const dataUrlImage = await call('PATCH', `/api/ads/${adId}`, {
      token: alice.token,
      body: { images: [png] },
    });
    assert.equal(dataUrlImage.status, 400, 'raw data URLs must be uploaded first');
  });

  test('deleting ads, logout and unknown routes', async () => {
    assert.equal((await call('DELETE', `/api/ads/${adId}`, { token: bob.token })).status, 403);
    assert.equal((await call('DELETE', `/api/ads/${adId}`, { token: alice.token })).status, 200);
    assert.equal((await call('GET', `/api/ads/${adId}`)).status, 404);

    await call('POST', '/api/auth/logout', { token: alice.token });
    assert.equal((await call('GET', '/api/me', { token: alice.token })).status, 401);

    assert.equal((await call('GET', '/api/nope')).status, 404);
    assert.equal((await call('DELETE', '/api/health')).status, 405);
    const cors = await fetch(base + '/api/ads', {
      method: 'OPTIONS',
      headers: { Origin: 'https://localhost' },
    });
    assert.equal(cors.status, 204);
    assert.equal(cors.headers.get('access-control-allow-origin'), '*');
  });
});
