/**
 * Bazaar — Cloud Functions (2nd gen, Mumbai region).
 *
 * Everything that must not be trusted to the app lives here: notifications and push,
 * save counts, ratings, auto-review after reports, paid boosts (Razorpay),
 * moderation and account deletion.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2';
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import * as functionsV1 from 'firebase-functions/v1';

initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

export const REGION = 'asia-south1';
setGlobalOptions({ region: REGION, maxInstances: 10 });

const DAY = 86_400_000;
const BOOST_DAYS = 7;
const BOOST_PRICE_PAISE = 14_900;
const AUTO_REVIEW_REPORTS = 3;
const AVATAR_COLORS = ['#0AA98C', '#8B5CF6', '#F59E0B', '#DB2777', '#2563EB', '#EA580C', '#16A34A'];
const DEMO_REPLIES = [
  'Yes, it is still available. When would you like to see it?',
  'I can do a small discount for a quick pickup. Cash or UPI both work.',
  'Sure — I am free after 6pm today. You can inspect it properly before paying.',
  'Thanks for reaching out! Please share your preferred time and I will keep it ready.',
];

/** Comma-separated Google account emails that get moderator access. */
const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { default: '' });
/** Razorpay — leave the key id empty and boosts stay free. */
const RAZORPAY_KEY_ID = defineString('RAZORPAY_KEY_ID', { default: '' });
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');
/** Set to "1" only in the emulator test suite: fakes Razorpay order creation. */
const FAKE_RAZORPAY = process.env.BAZAAR_FAKE_RAZORPAY === '1';

const now = () => Date.now();
const firstName = (name) => (name || 'Someone').split(' ')[0];
const paymentsOn = () => !!RAZORPAY_KEY_ID.value();
const adminEmails = () =>
  ADMIN_EMAILS.value()
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/* --------------------------------- helpers -------------------------------- */

async function notify(uid, type, title, body, href) {
  const user = await db.doc(`users/${uid}`).get();
  if (!user.exists || user.get('isDemo')) return;
  await db.collection(`users/${uid}/notifications`).add({
    type,
    title,
    body: String(body).slice(0, 200),
    href: href ?? null,
    read: false,
    createdAt: now(),
  });
  await push(uid, title, body, href);
}

/** Sends a push notification to every device the user registered. Stale tokens are removed. */
async function push(uid, title, body, href) {
  const tokens = await db.collection(`users/${uid}/tokens`).get();
  if (tokens.empty) return;
  const list = tokens.docs.map((d) => d.id);
  try {
    const res = await getMessaging().sendEachForMulticast({
      tokens: list,
      notification: { title, body: String(body).slice(0, 180) },
      data: { href: href ?? '/' },
      android: { priority: 'high', notification: { channelId: 'bazaar', color: '#0AA98C' } },
    });
    await Promise.all(
      res.responses.map((r, i) =>
        !r.success && /registration-token-not-registered|invalid-argument/.test(r.error?.code ?? '')
          ? db.doc(`users/${uid}/tokens/${list[i]}`).delete()
          : null,
      ),
    );
  } catch (err) {
    console.warn('push failed', uid, err?.message);
  }
}

function requireAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in to continue');
  return req.auth;
}
function requireAdmin(req) {
  const auth = requireAuth(req);
  if (auth.token.admin !== true) throw new HttpsError('permission-denied', 'Moderators only');
  return auth;
}

async function applyBoost(adId) {
  const ref = db.doc(`ads/${adId}`);
  const ad = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return null;
    const from = Math.max(now(), snap.get('boostedUntil') ?? 0);
    t.update(ref, { boosted: true, featured: true, boostedUntil: from + BOOST_DAYS * DAY });
    return snap.data();
  });
  if (ad) {
    await notify(
      ad.sellerId,
      'boost',
      `Boost active · ${BOOST_DAYS} days`,
      `“${ad.title}” is now featured at the top of nearby searches.`,
      `/ad/${adId}`,
    );
  }
}

async function markPaid(orderId, paymentId) {
  const ref = db.doc(`payments/${orderId}`);
  const pay = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists || snap.get('status') === 'paid') return null;
    t.update(ref, { status: 'paid', paymentId, paidAt: now() });
    return snap.data();
  });
  if (pay) await applyBoost(pay.adId);
}

const hmacHex = (secret, data) => createHmac('sha256', secret).update(data).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

async function ownAd(uid, adId) {
  const snap = await db.doc(`ads/${adId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Ad not found');
  if (snap.get('sellerId') !== uid) throw new HttpsError('permission-denied', 'Not your ad');
  return snap;
}

/* --------------------------------- accounts ------------------------------- */

/** New sign-in: create the public profile and grant moderator access if listed. */
export const onUserCreated = functionsV1
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    const admin = !!user.email && adminEmails().includes(user.email.toLowerCase());
    if (admin) await getAuth().setCustomUserClaims(user.uid, { admin: true });
    await db.doc(`users/${user.uid}`).set(
      {
        name: user.displayName || 'Bazaar user',
        area: 'Salt Lake',
        avatarColor: AVATAR_COLORS[randomInt(AVATAR_COLORS.length)],
        photoURL: user.photoURL ?? null,
        createdAt: now(),
        role: admin ? 'admin' : 'user',
        banned: false,
        verified: !!user.emailVerified,
        rating: 5,
        reviewsCount: 0,
        responseRate: 100,
        responseTime: 'within an hour',
        isDemo: false,
      },
      { merge: true },
    );
  });

/** Lets an account that was added to ADMIN_EMAILS later pick up moderator access. */
export const refreshRole = onCall(async (req) => {
  const auth = requireAuth(req);
  const admin =
    !!auth.token.email && adminEmails().includes(String(auth.token.email).toLowerCase());
  if (admin !== (auth.token.admin === true)) {
    await getAuth().setCustomUserClaims(auth.uid, admin ? { admin: true } : {});
  }
  await db.doc(`users/${auth.uid}`).set({ role: admin ? 'admin' : 'user' }, { merge: true });
  return { role: admin ? 'admin' : 'user' };
});

/**
 * Google Play requires in-app account deletion. Removes the profile, ads, photos,
 * favourites, blocks, notifications, device tokens and reviews written by the user;
 * messages they sent stay in the other person's chat but are no longer linked to a profile.
 */
export const deleteAccount = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const ads = await db.collection('ads').where('sellerId', '==', uid).get();
  const writer = db.bulkWriter();
  ads.forEach((d) => writer.delete(d.ref));
  for (const sub of ['favorites', 'blocks', 'notifications', 'tokens']) {
    (await db.collection(`users/${uid}/${sub}`).get()).forEach((d) => writer.delete(d.ref));
  }
  (await db.collection('reviews').where('authorId', '==', uid).get()).forEach((d) =>
    writer.delete(d.ref),
  );
  writer.set(
    db.doc(`users/${uid}`),
    { name: 'Deleted user', photoURL: null, deleted: true, deletedAt: now() },
    { merge: true },
  );
  await writer.close();
  try {
    await getStorage()
      .bucket()
      .deleteFiles({ prefix: `ads/${uid}/` });
  } catch (err) {
    console.warn('photo cleanup skipped', err?.message);
  }
  await getAuth().deleteUser(uid);
  return { ok: true, adsDeleted: ads.size };
});

/* ---------------------------------- chats --------------------------------- */

export const onMessageCreated = onDocumentCreated(
  'chats/{chatId}/messages/{msgId}',
  async (event) => {
    const msg = event.data?.data();
    if (!msg) return;
    const chatRef = db.doc(`chats/${event.params.chatId}`);
    const chat = (await chatRef.get()).data();
    if (!chat) return;
    await chatRef.update({
      lastMessageAt: msg.createdAt ?? now(),
      lastText: msg.text.slice(0, 140),
    });

    const recipient = msg.senderId === chat.buyerId ? chat.sellerId : chat.buyerId;
    const sender = (await db.doc(`users/${msg.senderId}`).get()).data();
    await notify(
      recipient,
      'chat',
      msg.kind === 'offer'
        ? `${firstName(sender?.name)} sent an offer`
        : `${firstName(sender?.name)} sent a message`,
      msg.text,
      `/chats/${event.params.chatId}`,
    );

    // Seeded demo sellers answer automatically so a fresh marketplace feels alive.
    const other = await db.doc(`users/${recipient}`).get();
    if (other.get('isDemo') && msg.senderId !== recipient) {
      await new Promise((r) => setTimeout(r, 1200));
      await chatRef.collection('messages').add({
        senderId: recipient,
        text: DEMO_REPLIES[randomInt(DEMO_REPLIES.length)],
        kind: 'text',
        createdAt: now(),
        readAt: null,
      });
    }
  },
);

/* -------------------------------- favourites ------------------------------ */

export const onFavoriteCreated = onDocumentCreated('users/{uid}/favorites/{adId}', async (e) => {
  await db
    .doc(`ads/${e.params.adId}`)
    .update({ saves: FieldValue.increment(1) })
    .catch(() => undefined);
});

export const onFavoriteDeleted = onDocumentDeleted('users/{uid}/favorites/{adId}', async (e) => {
  const ref = db.doc(`ads/${e.params.adId}`);
  await db
    .runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (snap.exists) t.update(ref, { saves: Math.max(0, (snap.get('saves') ?? 0) - 1) });
    })
    .catch(() => undefined);
});

/** Price drops notify everyone who saved the ad. */
export const onAdUpdated = onDocumentUpdated('ads/{adId}', async (e) => {
  const before = e.data?.before.data();
  const after = e.data?.after.data();
  if (!before || !after || after.status !== 'active' || !(after.price < before.price)) return;
  const pct = Math.round(((before.price - after.price) / before.price) * 100);
  const favs = await db.collectionGroup('favorites').where('adId', '==', e.params.adId).get();
  await Promise.all(
    favs.docs.map((d) =>
      notify(
        d.ref.parent.parent.id,
        'price',
        `Price dropped ${pct}%`,
        `“${after.title}” is now ₹${after.price.toLocaleString('en-IN')}.`,
        `/ad/${e.params.adId}`,
      ),
    ),
  );
});

/* --------------------------------- reviews -------------------------------- */

export const onReviewCreated = onDocumentCreated('reviews/{id}', async (e) => {
  const r = e.data?.data();
  if (!r) return;
  const ref = db.doc(`users/${r.sellerId}`);
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists) return;
    const count = s.get('reviewsCount') ?? 0;
    const rating = s.get('rating') ?? 5;
    t.update(ref, { rating: (rating * count + r.rating) / (count + 1), reviewsCount: count + 1 });
  });
  await notify(r.sellerId, 'system', `New ${r.rating}★ review`, r.text, `/seller/${r.sellerId}`);
});

/* --------------------------------- reports -------------------------------- */

/** Several different people reporting an ad hides it until a moderator looks. */
export const onReportCreated = onDocumentCreated('reports/{id}', async (e) => {
  const r = e.data?.data();
  if (!r) return;
  await e.data.ref.update({ createdAt: r.createdAt ?? now() });
  if (r.targetType !== 'ad') return;
  const open = await db
    .collection('reports')
    .where('targetType', '==', 'ad')
    .where('targetId', '==', r.targetId)
    .where('status', '==', 'open')
    .get();
  const reporters = new Set(open.docs.map((d) => d.get('reporterId')));
  if (reporters.size < AUTO_REVIEW_REPORTS) return;
  const adRef = db.doc(`ads/${r.targetId}`);
  const ad = (await adRef.get()).data();
  if (ad?.status !== 'active') return;
  await adRef.update({ status: 'pending' });
  await notify(
    ad.sellerId,
    'system',
    'Your ad is under review',
    `“${ad.title}” was reported by several people and is hidden while our team checks it.`,
    '/myads',
  );
});

/* ------------------------------- moderation ------------------------------- */

async function reportTarget(r) {
  const sellerView = async (id) => {
    const u = await db.doc(`users/${id}`).get();
    return u.exists ? { id, ...u.data(), banned: !!u.get('banned') } : null;
  };
  if (r.targetType === 'ad') {
    const ad = await db.doc(`ads/${r.targetId}`).get();
    if (!ad.exists) return { kind: 'ad', missing: true };
    return {
      kind: 'ad',
      ad: { id: ad.id, ...ad.data() },
      seller: await sellerView(ad.get('sellerId')),
    };
  }
  const seller = await sellerView(r.targetId);
  return seller ? { kind: 'seller', seller } : { kind: 'seller', missing: true };
}

export const adminStats = onCall(async (req) => {
  requireAdmin(req);
  const count = async (q) => (await q.count().get()).data().count;
  const paid = await db.collection('payments').where('status', '==', 'paid').get();
  return {
    users: await count(db.collection('users').where('isDemo', '==', false)),
    liveAds: await count(db.collection('ads').where('status', '==', 'active')),
    underReview: await count(db.collection('ads').where('status', '==', 'pending')),
    openReports: await count(db.collection('reports').where('status', '==', 'open')),
    banned: await count(db.collection('users').where('banned', '==', true)),
    revenuePaise: paid.docs.reduce((n, d) => n + (d.get('amount') ?? 0), 0),
  };
});

export const adminReports = onCall(async (req) => {
  requireAdmin(req);
  const resolved = req.data?.status === 'resolved';
  const snap = resolved
    ? await db.collection('reports').where('status', '==', 'resolved').limit(200).get()
    : await db.collection('reports').where('status', '==', 'open').limit(200).get();
  const reports = await Promise.all(
    snap.docs.map(async (d) => {
      const r = d.data();
      const reporter = await db.doc(`users/${r.reporterId}`).get();
      const open = await db
        .collection('reports')
        .where('targetType', '==', r.targetType)
        .where('targetId', '==', r.targetId)
        .where('status', '==', 'open')
        .get();
      return {
        id: d.id,
        ...r,
        reporterName: reporter.get('name') || 'Bazaar user',
        openReportsOnTarget: new Set(open.docs.map((x) => x.get('reporterId'))).size,
        target: await reportTarget(r),
      };
    }),
  );
  reports.sort((a, b) =>
    resolved ? (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0) : b.createdAt - a.createdAt,
  );
  return { reports };
});

export const adminResolve = onCall(async (req) => {
  const admin = requireAdmin(req);
  const { reportId, action } = req.data ?? {};
  if (!['dismiss', 'restore', 'remove', 'ban'].includes(action))
    throw new HttpsError('invalid-argument', 'Unknown action');
  const repRef = db.doc(`reports/${reportId}`);
  const report = (await repRef.get()).data();
  if (!report) throw new HttpsError('not-found', 'Report not found');
  const adSnap = report.targetType === 'ad' ? await db.doc(`ads/${report.targetId}`).get() : null;
  const ad = adSnap?.exists ? adSnap.data() : null;
  const userId = report.targetType === 'seller' ? report.targetId : ad?.sellerId;
  const stamp = (resolution) => ({
    status: 'resolved',
    resolution,
    resolvedAt: now(),
    resolvedBy: admin.uid,
  });

  const closeOpen = async (field, values, resolution) => {
    for (const value of values) {
      const q = await db
        .collection('reports')
        .where(field, '==', value)
        .where('status', '==', 'open')
        .get();
      await Promise.all(q.docs.map((d) => d.ref.update(stamp(resolution))));
    }
  };

  if (action === 'dismiss') {
    await repRef.update(stamp('dismissed'));
    if (ad?.status === 'pending') {
      const left = await db
        .collection('reports')
        .where('targetId', '==', report.targetId)
        .where('status', '==', 'open')
        .get();
      if (left.empty) await adSnap.ref.update({ status: 'active' });
    }
  } else if (action === 'restore') {
    if (!ad) throw new HttpsError('failed-precondition', 'Only ads can be restored');
    await adSnap.ref.update({ status: 'active' });
    await closeOpen('targetId', [report.targetId], 'restored');
    await notify(
      ad.sellerId,
      'system',
      'Your ad is live again',
      `“${ad.title}” passed review.`,
      `/ad/${adSnap.id}`,
    );
  } else if (action === 'remove') {
    if (!ad)
      throw new HttpsError(
        'failed-precondition',
        'This report is not about an ad — ban the seller instead',
      );
    await adSnap.ref.update({ status: 'removed', boosted: false, featured: false });
    await closeOpen('targetId', [report.targetId], 'removed');
    await notify(
      ad.sellerId,
      'system',
      'Your ad was removed',
      `“${ad.title}” broke Bazaar's posting rules and was taken down.`,
      '/myads',
    );
  } else if (action === 'ban') {
    if (!userId) throw new HttpsError('not-found', 'Seller not found');
    const target = await db.doc(`users/${userId}`).get();
    if (target.get('role') === 'admin')
      throw new HttpsError('failed-precondition', "Admins can't be banned here");
    await db.doc(`users/${userId}`).set({ banned: true }, { merge: true });
    await getAuth()
      .updateUser(userId, { disabled: true })
      .catch(() => undefined);
    await getAuth()
      .revokeRefreshTokens(userId)
      .catch(() => undefined);
    const ads = await db.collection('ads').where('sellerId', '==', userId).get();
    await Promise.all(
      ads.docs.map((d) => d.ref.update({ status: 'removed', boosted: false, featured: false })),
    );
    await closeOpen('targetId', [userId, ...ads.docs.map((d) => d.id)], 'banned');
  }
  return { ok: true, target: await reportTarget(report) };
});

export const adminUnban = onCall(async (req) => {
  requireAdmin(req);
  const uid = String(req.data?.uid ?? '');
  await db.doc(`users/${uid}`).set({ banned: false }, { merge: true });
  await getAuth()
    .updateUser(uid, { disabled: false })
    .catch(() => undefined);
  return { ok: true };
});

/* --------------------------------- boosts --------------------------------- */

/** Free boost — only while Razorpay is not configured. */
export const freeBoost = onCall(async (req) => {
  const { uid } = requireAuth(req);
  if (paymentsOn())
    throw new HttpsError('failed-precondition', 'Boosts are paid — start a payment first');
  const ad = await ownAd(uid, String(req.data?.adId));
  if (ad.get('status') !== 'active')
    throw new HttpsError('failed-precondition', 'Only live ads can be boosted');
  await applyBoost(ad.id);
  return { ad: { id: ad.id, ...(await ad.ref.get()).data() } };
});

export const createBoostOrder = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (req) => {
  const { uid } = requireAuth(req);
  if (!paymentsOn()) throw new HttpsError('failed-precondition', 'Payments are not set up');
  const ad = await ownAd(uid, String(req.data?.adId));
  if (ad.get('status') !== 'active')
    throw new HttpsError('failed-precondition', 'Only live ads can be boosted');
  let orderId;
  if (FAKE_RAZORPAY) {
    orderId = `order_fake_${now()}_${randomInt(1e6)}`;
  } else {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${RAZORPAY_KEY_ID.value()}:${RAZORPAY_KEY_SECRET.value()}`).toString(
            'base64',
          ),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: BOOST_PRICE_PAISE,
        currency: 'INR',
        receipt: `boost_${ad.id}`.slice(0, 40),
      }),
    });
    if (!res.ok)
      throw new HttpsError('unavailable', 'Payment provider is unavailable — try again shortly');
    orderId = (await res.json()).id;
  }
  await db.doc(`payments/${orderId}`).set({
    userId: uid,
    adId: ad.id,
    amount: BOOST_PRICE_PAISE,
    currency: 'INR',
    status: 'created',
    createdAt: now(),
  });
  return {
    orderId,
    amount: BOOST_PRICE_PAISE,
    currency: 'INR',
    keyId: RAZORPAY_KEY_ID.value(),
    description: `${BOOST_DAYS}-day boost · ${ad.get('title')}`.slice(0, 80),
  };
});

export const verifyBoostPayment = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (req) => {
  const { uid } = requireAuth(req);
  const { orderId, paymentId, signature } = req.data ?? {};
  const pay = await db.doc(`payments/${String(orderId)}`).get();
  if (!pay.exists || pay.get('userId') !== uid)
    throw new HttpsError('not-found', 'Payment not found');
  if (!safeEqual(hmacHex(RAZORPAY_KEY_SECRET.value(), `${orderId}|${paymentId}`), signature))
    throw new HttpsError('invalid-argument', 'Payment could not be verified');
  await markPaid(String(orderId), String(paymentId));
  const ad = await db.doc(`ads/${pay.get('adId')}`).get();
  return { ad: { id: ad.id, ...ad.data() }, status: 'paid' };
});

/** Razorpay webhook: events payment.captured / order.paid. */
export const razorpayWebhook = onRequest(
  { secrets: [RAZORPAY_WEBHOOK_SECRET] },
  async (req, res) => {
    const sig = req.get('x-razorpay-signature');
    if (
      req.method !== 'POST' ||
      !sig ||
      !safeEqual(hmacHex(RAZORPAY_WEBHOOK_SECRET.value(), req.rawBody), sig)
    ) {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
    const entity = req.body?.payload?.payment?.entity;
    if (['payment.captured', 'order.paid'].includes(req.body?.event) && entity?.order_id) {
      await markPaid(entity.order_id, entity.id);
    }
    res.json({ ok: true });
  },
);

/** Keeps config/public in step with the server settings the app needs to know. */
export const publicConfig = onCall(async () => {
  const cfg = { payments: paymentsOn(), boostPricePaise: BOOST_PRICE_PAISE, boostDays: BOOST_DAYS };
  await db.doc('config/public').set(cfg);
  return cfg;
});
