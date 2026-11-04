/**
 * End-to-end check of the app ↔ Firebase integration: runs the app's real store and
 * Firebase layer (src/lib/store.ts, backend.ts, firebaseSync.ts) against the emulators,
 * with Cloud Functions and security rules live.
 *
 *   npx firebase-tools emulators:exec --project demo-bazaar \
 *     --only auth,firestore,functions,storage "node scripts/firebase-e2e.mjs"
 * (needs `npm install` at the root and in functions/, Node 22.18+)
 */
import { register } from 'node:module';

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

process.env.VITE_FIREBASE_CONFIG = JSON.stringify({
  apiKey: 'fake-api-key',
  authDomain: 'localhost',
  projectId: 'demo-bazaar',
  storageBucket: 'demo-bazaar.appspot.com',
  appId: '1:000:web:e2e',
});
process.env.VITE_FIREBASE_EMULATOR = '1';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ??= 'demo-bazaar';
// Hooks run in a worker that snapshots the environment, so register after setting it.
register('./ts-loader.mjs', import.meta.url);

const { adminDb } = await import('../functions/scripts/admin.mjs');
const { seed } = await import('../functions/scripts/seed.mjs');
const admin = adminDb();
await seed(admin, { force: true });

const { useStore } = await import('../src/lib/store.ts');
const backend = await import('../src/lib/backend.ts');

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 10000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await fn()) return true;
    } catch {
      /* keep polling */
    }
    await wait(80);
  }
  return false;
};
const S = () => useStore.getState();

try {
  check(backend.backend === 'firebase', 'Firebase mode is on when VITE_FIREBASE_CONFIG is set');

  backend.startSync();
  check(
    await until(() => S().ads.length >= 16 && S().ads.every((a) => a.status === 'active' || a.status === 'sold')),
    'guest sees the live marketplace from Firestore',
  );
  check(S().user === null, 'guest is signed out');
  check(await until(() => S().serverConfig != null), 'public config loaded');

  /* ---------------- Google sign-in + onboarding, like the Login screen ---------------- */
  const fb = await backend.loadFirebase();
  const email = `arjun.${Date.now()}@test.dev`;
  const res = await fb.signInWithGoogleIdToken(
    JSON.stringify({ sub: `${email}-sub`, email, email_verified: true, name: 'Arjun G' }),
  );
  check(res.isNew, 'first Google sign-in creates a new account');
  await fb.saveProfile('Arjun Sen', 'Ballygunge');
  check(
    await until(() => S().user?.name === 'Arjun Sen' && S().area === 'Ballygunge'),
    'profile saved and mirrored into the store',
  );
  const uid = S().user?.remoteId;
  check(!!uid && S().user?.email === email && S().user?.id === 'me', 'session maps the uid to "me"');

  /* ---------------- favourites ---------------- */
  const target = S().ads.find((a) => a.sellerId === 'u2' && a.status === 'active');
  const savesBefore = target.saves;
  S().toggleFavorite(target.id);
  check(
    await until(async () => (await admin.doc(`users/${uid}/favorites/${target.id}`).get()).exists),
    'favourite written to Firestore',
  );
  check(
    await until(() => S().ads.find((a) => a.id === target.id)?.saves === savesBefore + 1),
    'save count updated by the function and streamed back',
  );

  /* ---------------- posting an ad ---------------- */
  const adId = `ad-e2e-${Date.now()}`;
  S().createAd({
    id: adId,
    title: 'Hero Sprint 26T cycle, barely used',
    description: 'Bought in March, ridden a handful of times. Comes with lock and lights.',
    price: 6500,
    category: 'sports',
    condition: 'like-new',
    images: [],
    area: 'Ballygunge',
    city: 'Kolkata',
    distanceKm: 0,
    sellerId: 'me',
    createdAt: Date.now(),
    views: 0,
    saves: 0,
    featured: false,
    boosted: false,
    negotiable: true,
    delivery: false,
    status: 'active',
    attributes: {},
  });
  check(
    await until(async () => (await admin.doc(`ads/${adId}`).get()).get('sellerId') === uid),
    'new ad stored with the real seller uid',
  );
  check(
    await until(() => S().ads.some((a) => a.id === adId && a.sellerId === 'me')),
    'own ad streams back as "me"',
  );

  S().dropPrice(adId, 5900);
  check(
    await until(async () => {
      const d = (await admin.doc(`ads/${adId}`).get()).data();
      return d.price === 5900 && d.priceHistory?.length === 2;
    }),
    'price drop saved with history',
  );

  S().updateAd(adId, { title: 'Hero Sprint 26T cycle with lock' });
  check(
    await until(async () => (await admin.doc(`ads/${adId}`).get()).get('title') === 'Hero Sprint 26T cycle with lock'),
    'ad edit saved',
  );

  /* ---------------- chat with a demo seller ---------------- */
  const chatAd = S().ads.find((a) => a.sellerId === 'u1' && a.status === 'active');
  const chatId = S().startChat(chatAd.id);
  check(chatId === `${chatAd.id}_${uid}`, 'chat id is <adId>_<uid>');
  S().sendMessage(chatId, 'Hi, is this still available?');
  check(
    await until(async () => (await admin.collection(`chats/${chatId}/messages`).get()).size >= 1),
    'chat created and message stored',
  );
  check(
    await until(() => {
      const c = S().chats.find((x) => x.id === chatId);
      return c?.sellerId === 'u1' && c.messages.some((m) => m.senderId === 'u1');
    }, 15000),
    'seller reply arrives live in the store',
  );
  check(S().notifications.some((n) => n.type === 'chat'), 'chat notification received');
  S().markChatRead(chatId);
  check(
    await until(async () => {
      const ms = await admin.collection(`chats/${chatId}/messages`).where('senderId', '==', 'u1').get();
      return !ms.empty && ms.docs.every((m) => m.get('readAt') != null);
    }),
    'seller messages marked read',
  );
  S().markAllNotificationsRead();
  check(
    await until(async () => {
      const ns = await admin.collection(`users/${uid}/notifications`).get();
      return ns.docs.every((n) => n.get('read') === true);
    }),
    'notifications marked read',
  );

  /* ---------------- reviews, blocks, reports ---------------- */
  S().addReview({ sellerId: 'u3', authorId: 'me', authorName: 'Arjun Sen', rating: 5, text: 'Smooth deal, item exactly as described.' });
  check(
    await until(async () => (await admin.doc(`reviews/u3_${uid}`).get()).exists),
    'review saved (one per buyer per seller)',
  );
  check(await until(() => S().reviews.some((r) => r.id === `u3_${uid}`)), 'review streams back');

  S().blockSeller('u4');
  check(
    await until(() => S().blockedSellers.includes('u4') && !S().ads.some((a) => a.sellerId === 'u4')),
    "blocking hides that seller's ads",
  );
  S().unblockSeller('u4');
  check(await until(() => S().ads.some((a) => a.sellerId === 'u4')), 'unblocking brings them back');

  S().report('ad', chatAd.id, 'Looks like a scam');
  check(
    await until(async () => !(await admin.collection('reports').where('reporterId', '==', uid).get()).empty),
    'report filed',
  );

  /* ---------------- sign out ---------------- */
  S().logout();
  check(
    await until(() => S().user === null && S().chats.length === 0 && S().favorites.length === 0),
    'sign-out clears private data',
  );
  check(S().ads.length >= 16, 'marketplace still browsable after sign-out');
} catch (e) {
  console.error(e);
  failures++;
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll Firebase e2e checks passed');
process.exit(failures ? 1 : 0);
