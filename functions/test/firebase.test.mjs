/**
 * Runs against the Firebase emulators (Auth, Firestore, Functions, Storage):
 *   npx firebase-tools emulators:exec --project demo-bazaar "npm --prefix functions test"
 * Users sign in with Google exactly like the app does (the emulator accepts test credentials),
 * so security rules and Cloud Functions are exercised together.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { initializeApp as adminInit } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { seed } from '../scripts/seed.mjs';

const PROJECT = 'demo-bazaar';
const REGION = 'asia-south1';
const KEY_SECRET = 'rzp_test_secret';
const WEBHOOK_SECRET = 'whsec_test';
const sign = (secret, data) => createHmac('sha256', secret).update(data).digest('hex');

adminInit({ projectId: PROJECT });
const admin = adminDb();
const apps = [];

async function until(fn, ms = 15000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 150));
  }
  return last;
}

/** A signed-in user with their own client SDK instance (Google sign-in, as in the app). */
let seq = 0;
async function user(name, email = `user${++seq}@test.dev`) {
  const app = initializeApp(
    { projectId: PROJECT, apiKey: 'fake', authDomain: 'localhost' },
    `u${seq}-${Date.now()}`,
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const fns = getFunctions(app, REGION);
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const cred = GoogleAuthProvider.credential(
    JSON.stringify({ sub: `${email}-sub`, email, email_verified: true, name }),
  );
  const { user: u } = await signInWithCredential(auth, cred);
  // Wait for the onUserCreated trigger to create the profile.
  await until(async () => (await admin.doc(`users/${u.uid}`).get()).exists);
  await u.getIdToken(true);
  // Like the app's onboarding step: the user confirms their display name and area.
  await updateDoc(doc(db, 'users', u.uid), { name, area: 'Salt Lake' });
  const call = (fn, data) => httpsCallable(fns, fn)(data).then((r) => r.data);
  return { uid: u.uid, user: u, db, call, email };
}

async function newAd(u, extra = {}) {
  const ref = doc(collection(u.db, 'ads'));
  await setDoc(ref, {
    title: 'Wooden bookshelf, 5 rows',
    description: 'Solid wood.',
    price: 2500,
    category: 'furniture',
    condition: 'good',
    images: [],
    area: 'Behala',
    city: 'Kolkata',
    distanceKm: 1,
    sellerId: u.uid,
    createdAt: Date.now(),
    views: 0,
    saves: 0,
    featured: false,
    boosted: false,
    negotiable: true,
    status: 'active',
    attributes: {},
    ...extra,
  });
  return ref.id;
}

const denied = async (p) =>
  assert.rejects(p, (e) => /permission|PERMISSION_DENIED/i.test(String(e.code ?? e.message)));

before(async () => {
  await seed(admin, { force: true });
});

after(async () => {
  await Promise.all(apps.map((a) => deleteApp(a).catch(() => {})));
});

describe('profiles and ads', () => {
  test('Google sign-in creates a public profile', async () => {
    const u = await user('Asha Sen');
    const profile = (await getDoc(doc(u.db, 'users', u.uid))).data();
    assert.equal(profile.name, 'Asha Sen');
    assert.equal(profile.role, 'user');
    assert.equal(profile.isDemo, false);
    assert.equal(profile.email, undefined, 'no email in the public profile');
    await updateDoc(doc(u.db, 'users', u.uid), { area: 'Garia', name: 'Asha S.' });
    await denied(updateDoc(doc(u.db, 'users', u.uid), { role: 'admin' }));
    await denied(updateDoc(doc(u.db, 'users', u.uid), { rating: 1 }));
  });

  test('seeded marketplace is public; drafts are private', async () => {
    const u = await user('Reader');
    const live = await getDocs(
      query(collection(u.db, 'ads'), where('status', 'in', ['active', 'sold'])),
    );
    assert.ok(live.size >= 16);
    const owner = await user('Drafty');
    const draftId = await newAd(owner, { status: 'draft' });
    await denied(getDoc(doc(u.db, 'ads', draftId)));
    assert.equal((await getDoc(doc(owner.db, 'ads', draftId))).data().status, 'draft');
  });

  test('sellers cannot forge counters, boosts or other sellers', async () => {
    const u = await user('Forger');
    await denied(newAd(u, { saves: 50 }));
    await denied(newAd(u, { boosted: true }));
    await denied(newAd(u, { sellerId: 'u1' }));
    await denied(newAd(u, { title: 'short' }));
    const id = await newAd(u);
    await denied(updateDoc(doc(u.db, 'ads', id), { featured: true }));
    await updateDoc(doc(u.db, 'ads', id), { price: 2200, title: 'Wooden bookshelf, 5 rows, teak' });
  });

  test('anyone signed in can count a view, one at a time', async () => {
    const u = await user('Viewer');
    const before = (await getDoc(doc(u.db, 'ads', 'ad-1'))).data().views;
    await updateDoc(doc(u.db, 'ads', 'ad-1'), { views: before + 1 });
    await denied(updateDoc(doc(u.db, 'ads', 'ad-1'), { views: before + 10 }));
  });
});

describe('favourites, price drops and reviews', () => {
  test('saving updates the count; a price drop notifies savers', async () => {
    const seller = await user('Price Cutter');
    const buyer = await user('Watcher');
    const adId = await newAd(seller, { price: 5000 });
    await setDoc(doc(buyer.db, 'users', buyer.uid, 'favorites', adId), {
      adId,
      createdAt: Date.now(),
    });
    assert.ok(await until(async () => (await admin.doc(`ads/${adId}`).get()).get('saves') === 1));
    await updateDoc(doc(seller.db, 'ads', adId), { price: 4000 });
    const n = await until(async () => {
      const s = await admin
        .collection(`users/${buyer.uid}/notifications`)
        .where('type', '==', 'price')
        .get();
      return s.size ? s.docs[0].data() : null;
    });
    assert.equal(n?.title, 'Price dropped 20%');
    await deleteDoc(doc(buyer.db, 'users', buyer.uid, 'favorites', adId));
    assert.ok(await until(async () => (await admin.doc(`ads/${adId}`).get()).get('saves') === 0));
  });

  test('one review per buyer updates the seller rating', async () => {
    const seller = await user('Rated Seller');
    const buyer = await user('Happy Buyer');
    const data = {
      sellerId: seller.uid,
      authorId: buyer.uid,
      authorName: 'Happy Buyer',
      rating: 4,
      text: 'Smooth deal, as described.',
      createdAt: Date.now(),
    };
    await setDoc(doc(buyer.db, 'reviews', `${seller.uid}_${buyer.uid}`), data);
    await denied(
      setDoc(doc(buyer.db, 'reviews', `${seller.uid}_${buyer.uid}`), { ...data, rating: 1 }),
    );
    await denied(
      setDoc(doc(seller.db, 'reviews', `${seller.uid}_${seller.uid}`), {
        ...data,
        authorId: seller.uid,
      }),
    );
    assert.ok(
      await until(
        async () => (await admin.doc(`users/${seller.uid}`).get()).get('reviewsCount') === 1,
      ),
    );
  });
});

describe('chat', () => {
  test('messages notify the other person; outsiders are kept out', async () => {
    const seller = await user('Chat Seller');
    const buyer = await user('Chat Buyer');
    const stranger = await user('Stranger');
    const adId = await newAd(seller);
    const chatId = `${adId}_${buyer.uid}`;
    await setDoc(doc(buyer.db, 'chats', chatId), {
      adId,
      buyerId: buyer.uid,
      sellerId: seller.uid,
      participants: [buyer.uid, seller.uid],
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    });
    await denied(
      setDoc(doc(stranger.db, 'chats', `${adId}_x`), {
        adId,
        buyerId: buyer.uid,
        sellerId: seller.uid,
        participants: [buyer.uid, seller.uid],
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
      }),
    );
    await addDoc(collection(buyer.db, 'chats', chatId, 'messages'), {
      senderId: buyer.uid,
      text: 'Would you take ₹2,000?',
      kind: 'offer',
      offerAmount: 2000,
      createdAt: Date.now(),
      readAt: null,
    });
    const n = await until(async () => {
      const s = await admin
        .collection(`users/${seller.uid}/notifications`)
        .where('type', '==', 'chat')
        .get();
      return s.size ? s.docs[0].data() : null;
    });
    assert.equal(n?.title, 'Chat sent an offer');
    assert.equal(
      (await admin.doc(`chats/${chatId}`).get()).get('lastText'),
      'Would you take ₹2,000?',
    );
    await denied(getDocs(collection(stranger.db, 'chats', chatId, 'messages')));
    await denied(
      addDoc(collection(buyer.db, 'chats', chatId, 'messages'), {
        senderId: seller.uid,
        text: 'spoofed',
        kind: 'text',
        createdAt: Date.now(),
        readAt: null,
      }),
    );
  });

  test('demo sellers reply automatically', async () => {
    const buyer = await user('Demo Buyer');
    const chatId = `ad-3_${buyer.uid}`;
    await setDoc(doc(buyer.db, 'chats', chatId), {
      adId: 'ad-3',
      buyerId: buyer.uid,
      sellerId: 'u2',
      participants: [buyer.uid, 'u2'],
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    });
    await addDoc(collection(buyer.db, 'chats', chatId, 'messages'), {
      senderId: buyer.uid,
      text: 'Still available?',
      kind: 'text',
      createdAt: Date.now(),
      readAt: null,
    });
    const msgs = await until(async () => {
      const s = await getDocs(collection(buyer.db, 'chats', chatId, 'messages'));
      return s.size >= 2 ? s : null;
    });
    assert.ok(msgs?.docs.some((d) => d.get('senderId') === 'u2'));
  });

  test('blocking stops new chats and messages', async () => {
    const seller = await user('Blocked Seller');
    const buyer = await user('Blocking Buyer');
    const adId = await newAd(seller);
    await setDoc(doc(buyer.db, 'users', buyer.uid, 'blocks', seller.uid), {
      createdAt: Date.now(),
    });
    await denied(
      setDoc(doc(buyer.db, 'chats', `${adId}_${buyer.uid}`), {
        adId,
        buyerId: buyer.uid,
        sellerId: seller.uid,
        participants: [buyer.uid, seller.uid],
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
      }),
    );
  });
});

describe('reports and moderation', () => {
  let mod, owner, adId;

  before(async () => {
    mod = await user('Moderator', 'admin@test.dev');
    await until(async () => (await mod.user.getIdTokenResult(true)).claims.admin === true);
    owner = await user('Reported Owner');
    adId = await newAd(owner, { title: 'Suspiciously cheap iPhone 15' });
  });

  test('ADMIN_EMAILS accounts become moderators; others cannot', async () => {
    assert.equal((await admin.doc(`users/${mod.uid}`).get()).get('role'), 'admin');
    await assert.rejects(owner.call('adminStats'), /permission|Moderators/i);
    const stats = await mod.call('adminStats');
    assert.ok(stats.liveAds >= 16);
  });

  test('three reporters hide an ad for review', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await user(`Reporter ${i}`);
      await addDoc(collection(r.db, 'reports'), {
        reporterId: r.uid,
        targetType: 'ad',
        targetId: adId,
        reason: 'Suspected scam',
        status: 'open',
        createdAt: Date.now(),
      });
    }
    assert.ok(
      await until(async () => (await admin.doc(`ads/${adId}`).get()).get('status') === 'pending'),
    );
    await denied(updateDoc(doc(owner.db, 'ads', adId), { status: 'active' }));
    const reader = await user('Public');
    await denied(getDoc(doc(reader.db, 'ads', adId)));
    await denied(getDocs(collection(reader.db, 'reports')));
  });

  test('restore, remove and ban', async () => {
    let { reports } = await mod.call('adminReports', { status: 'open' });
    let r = reports.find((x) => x.targetId === adId);
    assert.equal(r.openReportsOnTarget, 3);
    await mod.call('adminResolve', { reportId: r.id, action: 'restore' });
    assert.equal((await admin.doc(`ads/${adId}`).get()).get('status'), 'active');

    const late = await user('Late Reporter');
    await addDoc(collection(late.db, 'reports'), {
      reporterId: late.uid,
      targetType: 'ad',
      targetId: adId,
      reason: 'Fake item',
      status: 'open',
      createdAt: Date.now(),
    });
    ({ reports } = await until(async () => {
      const res = await mod.call('adminReports', { status: 'open' });
      return res.reports.some((x) => x.targetId === adId) ? res : null;
    }));
    r = reports.find((x) => x.targetId === adId);
    await mod.call('adminResolve', { reportId: r.id, action: 'remove' });
    assert.equal((await admin.doc(`ads/${adId}`).get()).get('status'), 'removed');

    const spammer = await user('Spammy Sam');
    const spamAd = await newAd(spammer, { title: 'Earn ₹50,000 a week from home' });
    await addDoc(collection(late.db, 'reports'), {
      reporterId: late.uid,
      targetType: 'seller',
      targetId: spammer.uid,
      reason: 'Advance payment',
      status: 'open',
      createdAt: Date.now(),
    });
    ({ reports } = await until(async () => {
      const res = await mod.call('adminReports', { status: 'open' });
      return res.reports.some((x) => x.targetId === spammer.uid) ? res : null;
    }));
    r = reports.find((x) => x.targetId === spammer.uid);
    await mod.call('adminResolve', { reportId: r.id, action: 'ban' });
    assert.equal((await adminAuth().getUser(spammer.uid)).disabled, true);
    assert.equal((await admin.doc(`ads/${spamAd}`).get()).get('status'), 'removed');
    await mod.call('adminUnban', { uid: spammer.uid });
    assert.equal((await adminAuth().getUser(spammer.uid)).disabled, false);
  });
});

describe('paid boosts (Razorpay, faked in the emulator)', () => {
  test('order → signature check → 7-day boost; webhook extends it', async () => {
    const seller = await user('Booster');
    const adId = await newAd(seller, { title: 'Study lamp with warm light' });
    await assert.rejects(seller.call('freeBoost', { adId }), /paid/i);
    const order = await seller.call('createBoostOrder', { adId });
    assert.equal(order.amount, 14900);
    await assert.rejects(
      seller.call('verifyBoostPayment', {
        orderId: order.orderId,
        paymentId: 'pay_1',
        signature: 'f'.repeat(64),
      }),
      /verified/i,
    );
    const res = await seller.call('verifyBoostPayment', {
      orderId: order.orderId,
      paymentId: 'pay_1',
      signature: sign(KEY_SECRET, `${order.orderId}|pay_1`),
    });
    assert.equal(res.ad.boosted, true);
    const days = (res.ad.boostedUntil - Date.now()) / 86_400_000;
    assert.ok(days > 6.9 && days <= 7);

    const other = await user('Mallory');
    await assert.rejects(
      other.call('verifyBoostPayment', {
        orderId: order.orderId,
        paymentId: 'pay_1',
        signature: sign(KEY_SECRET, `${order.orderId}|pay_1`),
      }),
      /not found/i,
    );

    const second = await seller.call('createBoostOrder', { adId });
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh', order_id: second.orderId } } },
    });
    const url = `http://127.0.0.1:5001/${PROJECT}/${REGION}/razorpayWebhook`;
    const forged = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': 'nope' },
      body,
    });
    assert.equal(forged.status, 400);
    const ok = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': sign(WEBHOOK_SECRET, body),
      },
      body,
    });
    assert.equal(ok.status, 200);
    const until14 = await until(async () => {
      const u = (await admin.doc(`ads/${adId}`).get()).get('boostedUntil');
      return u - Date.now() > 13.9 * 86_400_000 ? u : null;
    });
    assert.ok(until14, 'second payment extends the boost to ~14 days');
  });

  test('public config reflects payments', async () => {
    const u = await user('Config Reader');
    const cfg = await u.call('publicConfig');
    assert.deepEqual(cfg, { payments: true, boostPricePaise: 14900, boostDays: 7 });
  });
});

describe('account deletion (Google Play requirement)', () => {
  test('removes the account, its ads and private data', async () => {
    const u = await user('Leaving User');
    const adId = await newAd(u);
    await setDoc(doc(u.db, 'users', u.uid, 'favorites', 'ad-1'), {
      adId: 'ad-1',
      createdAt: Date.now(),
    });
    const res = await u.call('deleteAccount');
    assert.equal(res.adsDeleted, 1);
    assert.equal((await admin.doc(`ads/${adId}`).get()).exists, false);
    assert.equal((await admin.collection(`users/${u.uid}/favorites`).get()).size, 0);
    assert.equal((await admin.doc(`users/${u.uid}`).get()).get('name'), 'Deleted user');
    await assert.rejects(adminAuth().getUser(u.uid));
  });
});
