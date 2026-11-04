/**
 * End-to-end check of the app ↔ API integration: runs the app's real store and sync
 * layer (src/lib/store.ts, src/lib/sync.ts) against a real API server in-process.
 * Run: npm run test:sync   (needs `npm ci` and Node 22.18+)
 */
import { register } from 'node:module';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ---------- a minimal browser environment for the store ---------- */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.window = globalThis;
globalThis.document = { hidden: false, addEventListener() {} };

/* ---------- API server ---------- */
const { openDb } = await import('../server/db.js');
const { createApp } = await import('../server/app.js');
const uploads = mkdtempSync(join(tmpdir(), 'bazaar-e2e-'));
const db = openDb(':memory:');
const handler = createApp({
  db,
  devOtpCode: '1234',
  uploadsDir: uploads,
  demoReplyMs: 50,
  adminPhones: ['+919830012345'],
});
const server = createServer(handler);
await new Promise((r) => server.listen(0, r));
process.env.VITE_API_URL = `http://127.0.0.1:${server.address().port}`;
// Hooks run in a worker that snapshots the environment, so register after setting it.
register('./ts-loader.mjs', import.meta.url);

const { useStore } = await import('../src/lib/store.ts');
const sync = await import('../src/lib/sync.ts');
const { api, apiEnabled, setToken } = await import('../src/lib/api.ts');

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await wait(40);
  }
  return false;
};
const S = () => useStore.getState();

try {
  check(apiEnabled, 'API mode is on when VITE_API_URL is set');

  await sync.refresh();
  check(S().ads.length === 16 && S().user === null, 'guest bootstrap loads the server marketplace');
  check(S().chats.length === 0 && S().favorites.length === 0, 'guest has no private data');

  // Sign in exactly like the Login screen does.
  const otp = await api.requestOtp('9830012345');
  check(otp.devCode === '1234', 'OTP requested');
  const v = await api.verifyOtp('9830012345', '1234');
  check(v.isNew, 'new account created on first sign-in');
  setToken(v.token);
  const { user: me } = await api.updateMe({ name: 'Arjun Sen', area: 'Ballygunge' });
  await sync.completeSignIn(v.token, me);
  check(
    S().user?.name === 'Arjun Sen' && S().user?.remoteId === me.id,
    'signed in with server account',
  );
  check(S().area === 'Ballygunge', 'area synced from account');
  check(S().user?.role === 'admin', 'moderator role comes from the server');
  check(
    S().serverConfig?.payments === false,
    'server config loaded (free boosts without Razorpay)',
  );

  // Distances are measured from the chosen area.
  const { adDistance } = await import('../src/lib/geo.ts');
  const ballygungeAd = S().ads.find((a) => a.area === 'Ballygunge');
  const farAd = S().ads.find((a) => a.area === 'Rajarhat');
  check(
    adDistance(ballygungeAd, 'Ballygunge') < 2 && adDistance(farAd, 'Ballygunge') > 8,
    `distances follow the chosen area (${adDistance(ballygungeAd, 'Ballygunge')} km vs ${adDistance(farAd, 'Ballygunge')} km)`,
  );

  // Post an ad with a freshly taken photo (data URL) — it must be uploaded first.
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  S().createAd({
    id: 'ad-e2e-1',
    title: 'Study table with drawer',
    description: 'Solid wood, lightly used.',
    price: 3500,
    category: 'furniture',
    condition: 'good',
    images: [png],
    area: 'Ballygunge',
    city: 'Kolkata',
    distanceKm: 1.2,
    sellerId: 'me',
    createdAt: Date.now(),
    views: 0,
    saves: 0,
    negotiable: true,
    status: 'active',
    attributes: { type: 'Table' },
  });
  const uploaded = await until(() =>
    S()
      .ads.find((a) => a.id === 'ad-e2e-1')
      ?.images[0]?.startsWith('http'),
  );
  check(uploaded, 'photo uploaded and ad saved with its server URL');
  const local = S().ads.find((a) => a.id === 'ad-e2e-1');
  check(local?.sellerId === 'me', "own ad still shows as 'me' after reconciling");
  const serverAd = await api.updateAd('ad-e2e-1', {});
  check(serverAd.ad.sellerId === me.id, 'server stored the ad under the account');

  // Edit + price drop.
  S().dropPrice('ad-e2e-1', 3000);
  await until(async () => (await api.updateAd('ad-e2e-1', {})).ad.price === 3000);
  check(
    (await api.updateAd('ad-e2e-1', {})).ad.priceHistory?.length === 2,
    'price drop recorded on server',
  );

  // Favourite a demo listing.
  S().toggleFavorite('ad-1');
  check(
    await until(async () => (await api.bootstrap()).favorites.includes('ad-1')),
    'favourite saved on server',
  );

  // Chat with a demo seller, who auto-replies; polling brings the reply in.
  const chatId = S().startChat('ad-3');
  S().sendMessage(chatId, 'Is the iPhone still available?');
  // No refresh() here: the reply must arrive through the live stream.
  const replied = await until(() => {
    const c = S().chats.find((x) => x.id === chatId);
    return !!c && c.messages.length >= 2;
    // The fallback poll only runs 2.5 s after sending, so arriving sooner proves the stream works.
  }, 2000);
  const chat = S().chats.find((x) => x.id === chatId);
  check(replied, 'message delivered and the reply arrived live (no polling)');
  check(
    chat?.sellerId === 'u2' && chat.messages[0].senderId === 'me',
    'chat mapped to me ↔ seller',
  );
  check(
    S().notifications.some((n) => n.type === 'chat'),
    'reply produced a notification',
  );

  // Review + block.
  S().addReview({
    sellerId: 'u2',
    authorId: 'me',
    authorName: 'Arjun Sen',
    rating: 5,
    text: 'Fast replies, honest seller.',
  });
  check(
    await until(async () => (await api.bootstrap()).reviews.some((r) => r.authorId === me.id)),
    'review stored on server',
  );
  // Boost (free while Razorpay isn't configured) gets a 7-day end date.
  S().boostAd('ad-e2e-1');
  check(
    await until(
      () =>
        (S().ads.find((a) => a.id === 'ad-e2e-1')?.boostedUntil ?? 0) > Date.now() + 6 * 86_400_000,
    ),
    'boost synced with a 7-day end date',
  );

  S().blockSeller('u2');
  check(
    await until(async () => (await api.bootstrap()).blocked.includes('u2')),
    'block saved on server',
  );
  await sync.refresh();
  check(!S().ads.some((a) => a.sellerId === 'u2'), "blocked seller's ads hidden after refresh");
  S().unblockSeller('u2');
  await until(async () => !(await api.bootstrap()).blocked.includes('u2'));

  // Sign out clears private data.
  S().logout();
  await until(() => S().chats.length === 0 && S().favorites.length === 0);
  check(S().user === null && S().chats.length === 0, 'sign-out clears private data');
} catch (err) {
  failures++;
  console.error('✗ crashed:', err);
} finally {
  sync.stopSync();
  handler.close();
  server.close();
  db.close();
  rmSync(uploads, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} sync check(s) failed` : '\nAll sync checks passed');
process.exit(failures ? 1 : 0);
