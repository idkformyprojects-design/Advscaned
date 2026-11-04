/**
 * Firebase data layer. Same contract as sync.ts (the self-hosted API version):
 * store actions stay synchronous and optimistic, `remote.*` pushes each change to
 * Firestore, and live listeners keep the store in step with the server.
 *
 * Ids: the signed-in user's uid is mapped to 'me' everywhere, and a chat's
 * `sellerId` is always the *other* person, exactly like the API mode.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  increment,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions';
import {
  connectStorageEmulator,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadString,
  type FirebaseStorage,
} from 'firebase/storage';
import type { AdminReport, AdminStats, BoostOrder, ResolveAction, ServerConfig } from './api';
import { registerSellers } from './data';
import { firebaseConfig, FUNCTIONS_REGION, useEmulators } from './firebase';
import { toast, useStore } from './store';
import type { Ad, AppNotification, Chat, Message, Review, Seller } from './types';

/* --------------------------------- setup --------------------------------- */

interface FB {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  fns: Functions;
}
let fb: FB | null = null;

function init(): FB {
  if (fb) return fb;
  if (!firebaseConfig) throw new Error('Firebase is not configured');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const storage = getStorage(app);
  const fns = getFunctions(app, FUNCTIONS_REGION);
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  }
  fb = { app, auth, db, storage, fns };
  return fb;
}

const call = async <T>(name: string, data?: unknown): Promise<T> =>
  (await httpsCallable(init().fns, name)(data)).data as T;

let uid: string | null = null;
const local = (id: string) => (id && id === uid ? 'me' : id);
const remoteId = (id: string) => (id === 'me' ? (uid ?? id) : id);

function fail(err: unknown, fallback: string) {
  const code = (err as { code?: string })?.code ?? '';
  const msg = /permission/.test(code)
    ? "You can't do that right now"
    : /unavailable|network/.test(code)
      ? "Can't reach Bazaar right now — check your connection"
      : ((err as Error)?.message && !/internal/i.test(code) ? (err as Error).message : fallback);
  toast(msg, 'error');
}

/* -------------------------------- mapping -------------------------------- */

function toSeller(id: string, d: DocumentData): Seller {
  return {
    id,
    name: d.name || 'Bazaar user',
    phone: '',
    avatarColor: d.avatarColor ?? '#0AA98C',
    rating: Math.round((d.rating ?? 5) * 10) / 10,
    reviews: d.reviewsCount ?? 0,
    joined: String(new Date(d.createdAt ?? Date.now()).getFullYear()),
    verified: d.verified !== false,
    responseRate: d.responseRate ?? 100,
    responseTime: d.responseTime ?? 'within an hour',
    ...(d.bio ? { bio: d.bio } : {}),
  };
}

function toAd(id: string, d: DocumentData): Ad {
  const boostedUntil = d.boostedUntil ?? undefined;
  return {
    id,
    title: d.title,
    description: d.description ?? '',
    price: d.price,
    category: d.category,
    condition: d.condition,
    images: d.images ?? [],
    area: d.area,
    city: d.city ?? 'Kolkata',
    distanceKm: d.distanceKm ?? 1,
    sellerId: local(d.sellerId),
    createdAt: d.createdAt ?? Date.now(),
    views: d.views ?? 0,
    saves: d.saves ?? 0,
    featured: !!d.featured,
    boosted: !!d.boosted && (!boostedUntil || boostedUntil > Date.now()),
    negotiable: !!d.negotiable,
    delivery: !!d.delivery,
    status: d.status,
    attributes: d.attributes ?? {},
    ...(d.warranty ? { warranty: d.warranty } : {}),
    ...(d.priceHistory ? { priceHistory: d.priceHistory } : {}),
    ...(boostedUntil ? { boostedUntil } : {}),
  };
}

/* ------------------------------ seller cache ------------------------------ */

const knownSellers = new Set<string>();
function ensureSellers(ids: string[]) {
  const missing = [...new Set(ids)].filter((id) => id && id !== uid && !knownSellers.has(id));
  if (!missing.length) return;
  missing.forEach((id) => knownSellers.add(id));
  const { db } = init();
  void Promise.all(
    missing.map(async (id) => {
      const snap = await getDoc(doc(db, 'users', id)).catch(() => null);
      return snap?.exists() ? toSeller(id, snap.data()) : null;
    }),
  ).then((list) => {
    const found = list.filter(Boolean) as Seller[];
    if (!found.length) return;
    registerSellers(found);
    // Nudge subscribers so names/avatars re-render.
    useStore.setState((s) => ({ ads: [...s.ads] }));
  });
}

/* ------------------------------- listeners ------------------------------- */

let publicUnsubs: Unsubscribe[] = [];
let privateUnsubs: Unsubscribe[] = [];
const messageUnsubs = new Map<string, Unsubscribe>();
let publicAds: Ad[] = [];
let myAds: Ad[] = [];
let started = false;

function mergeAds() {
  const byId = new Map<string, Ad>();
  [...publicAds, ...myAds].forEach((a) => byId.set(a.id, a));
  const blocked = new Set(useStore.getState().blockedSellers);
  useStore.setState({
    ads: [...byId.values()]
      .filter((a) => a.sellerId === 'me' || !blocked.has(a.sellerId))
      .sort((a, b) => b.createdAt - a.createdAt),
  });
}

function listenPublic() {
  const { db } = init();
  publicUnsubs.forEach((u) => u());
  publicUnsubs = [
    onSnapshot(
      query(collection(db, 'ads'), where('status', 'in', ['active', 'sold']), orderBy('createdAt', 'desc'), limit(400)),
      (snap) => {
        publicAds = snap.docs.map((d) => toAd(d.id, d.data()));
        ensureSellers(publicAds.map((a) => remoteId(a.sellerId)));
        mergeAds();
      },
      (err) => console.warn('[bazaar] ads listener', err),
    ),
    onSnapshot(
      query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(400)),
      (snap) =>
        useStore.setState({
          reviews: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Review, 'id'>) })),
        }),
      () => undefined,
    ),
    onSnapshot(
      doc(db, 'config', 'public'),
      (snap) => useStore.setState({ serverConfig: (snap.data() as ServerConfig) ?? null }),
      () => undefined,
    ),
  ];
}

function stopPrivate() {
  privateUnsubs.forEach((u) => u());
  privateUnsubs = [];
  messageUnsubs.forEach((u) => u());
  messageUnsubs.clear();
  myAds = [];
}

function listenPrivate(user: User) {
  const { db } = init();
  stopPrivate();
  const chatMeta = new Map<string, { adId: string; other: string; lastMessageAt: number }>();
  const chatMessages = new Map<string, Message[]>();

  const publishChats = () => {
    const prev = new Map(useStore.getState().chats.map((c) => [c.id, c]));
    const chats: Chat[] = [...chatMeta.entries()]
      .map(([id, m]) => ({
        id,
        adId: m.adId,
        buyerId: 'me',
        sellerId: m.other,
        archived: prev.get(id)?.archived,
        lastMessageAt: m.lastMessageAt,
        messages: chatMessages.get(id) ?? prev.get(id)?.messages ?? [],
      }))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    useStore.setState({ chats });
  };

  privateUnsubs.push(
    onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      const d = snap.data();
      if (!d) return;
      const token = await user.getIdTokenResult().catch(() => null);
      useStore.setState((s) => ({
        user: {
          id: 'me',
          remoteId: user.uid,
          name: d.name || user.displayName || 'Bazaar user',
          phone: '',
          email: user.email ?? undefined,
          area: d.area ?? s.area,
          avatarColor: d.avatarColor ?? '#0AA98C',
          joined: d.createdAt ?? Date.now(),
          role: token?.claims.admin === true ? 'admin' : 'user',
        },
        area: d.area ?? s.area,
        onboarded: true,
      }));
    }),
    onSnapshot(query(collection(db, 'ads'), where('sellerId', '==', user.uid)), (snap) => {
      myAds = snap.docs.map((d) => toAd(d.id, d.data()));
      mergeAds();
    }),
    onSnapshot(collection(db, 'users', user.uid, 'favorites'), (snap) =>
      useStore.setState({
        favorites: snap.docs
          .sort((a, b) => (b.get('createdAt') ?? 0) - (a.get('createdAt') ?? 0))
          .map((d) => d.id),
      }),
    ),
    onSnapshot(collection(db, 'users', user.uid, 'blocks'), (snap) => {
      useStore.setState({ blockedSellers: snap.docs.map((d) => d.id) });
      ensureSellers(snap.docs.map((d) => d.id));
      mergeAds();
    }),
    onSnapshot(
      query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => {
        const prev = new Set(useStore.getState().notifications.map((n) => n.id));
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }));
        useStore.setState({ notifications: list });
        const fresh = list.find((n) => !prev.has(n.id) && !n.read && n.type === 'chat');
        if (fresh && prev.size) browserNotify(fresh.title, fresh.body);
      },
    ),
    onSnapshot(
      query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), orderBy('lastMessageAt', 'desc')),
      (snap) => {
        const seen = new Set<string>();
        snap.docs.forEach((d) => {
          const c = d.data();
          const other = c.buyerId === user.uid ? c.sellerId : c.buyerId;
          seen.add(d.id);
          chatMeta.set(d.id, { adId: c.adId, other, lastMessageAt: c.lastMessageAt ?? 0 });
          if (!messageUnsubs.has(d.id)) {
            messageUnsubs.set(
              d.id,
              onSnapshot(
                query(collection(db, 'chats', d.id, 'messages'), orderBy('createdAt', 'asc')),
                (ms) => {
                  const prevMsgs = new Map(
                    (useStore.getState().chats.find((x) => x.id === d.id)?.messages ?? []).map((m) => [m.id, m]),
                  );
                  chatMessages.set(
                    d.id,
                    ms.docs.map((m) => {
                      const v = m.data();
                      const sender = local(v.senderId);
                      return {
                        id: m.id,
                        chatId: d.id,
                        senderId: sender,
                        text: v.text,
                        kind: v.kind,
                        offerAmount: v.offerAmount,
                        createdAt: v.createdAt,
                        read: sender === 'me' || v.readAt != null || !!prevMsgs.get(m.id)?.read,
                      };
                    }),
                  );
                  publishChats();
                },
              ),
            );
          }
        });
        for (const id of [...chatMeta.keys()]) {
          if (!seen.has(id)) {
            chatMeta.delete(id);
            messageUnsubs.get(id)?.();
            messageUnsubs.delete(id);
          }
        }
        ensureSellers([...chatMeta.values()].map((m) => m.other));
        publishChats();
      },
    ),
  );
}

function browserNotify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'bazaar-chat' });
  } catch {
    /* optional */
  }
}

/** Call once at app start. */
export function startSync() {
  if (started) return;
  started = true;
  const { auth } = init();
  listenPublic();
  let refreshed = false;
  onAuthStateChanged(auth, (user) => {
    uid = user?.uid ?? null;
    if (user) {
      listenPrivate(user);
      if (!refreshed) {
        refreshed = true;
        // Picks up moderator access granted after the account was created.
        void call<{ role: string }>('refreshRole')
          .then(() => user.getIdToken(true))
          .catch(() => undefined);
      }
    } else {
      stopPrivate();
      useStore.setState({ user: null, chats: [], favorites: [], notifications: [], blockedSellers: [] });
      mergeAds();
    }
  });
}

export function stopSync() {
  publicUnsubs.forEach((u) => u());
  publicUnsubs = [];
  stopPrivate();
  started = false;
}

/* ------------------------------- sign-in -------------------------------- */

/** Web: Google popup (falls back to a full-page redirect when popups are blocked). */
export async function signInWithGoogle(): Promise<{ isNew: boolean } | null> {
  const { auth } = init();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const res = await signInWithPopup(auth, provider);
    return { isNew: res.user.metadata.creationTime === res.user.metadata.lastSignInTime };
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
    throw err;
  }
}

/** Native apps (and tests): sign in with a Google ID token obtained elsewhere. */
export async function signInWithGoogleIdToken(idToken: string) {
  const { auth } = init();
  const res = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return { isNew: res.user.metadata.creationTime === res.user.metadata.lastSignInTime };
}

/** Finishes onboarding: the profile doc is created by a Cloud Function on first sign-in. */
export async function saveProfile(name: string, area: string) {
  const { auth, db } = init();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const ref = doc(db, 'users', user.uid);
  // The profile may still be being created by the onUserCreated function.
  for (let i = 0; i < 20; i++) {
    if ((await getDoc(ref)).exists()) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  await updateDoc(ref, { name: name.trim().slice(0, 40) || 'Bazaar user', area });
}

export const currentUserName = () => fb?.auth.currentUser?.displayName ?? '';

export async function deleteMyAccount() {
  await call('deleteAccount');
  await signOut(init().auth).catch(() => undefined);
}

/* ------------------------------- payments -------------------------------- */

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (e: string, cb: (x: { error?: { description?: string } }) => void) => void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;
let checkoutScript: Promise<RazorpayCtor> | null = null;

function loadCheckout(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  checkoutScript ??= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = 'https://checkout.razorpay.com/v1/checkout.js';
    el.async = true;
    el.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Checkout failed to load')));
    el.onerror = () => {
      checkoutScript = null;
      reject(new Error("Couldn't load the payment page — check your connection"));
    };
    document.head.appendChild(el);
  });
  return checkoutScript;
}

export async function payForBoost(adId: string): Promise<'paid' | 'cancelled'> {
  const order = await call<BoostOrder>('createBoostOrder', { adId });
  const Razorpay = await loadCheckout();
  const email = fb?.auth.currentUser?.email ?? undefined;
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Bazaar',
      description: order.description,
      prefill: email ? { email } : undefined,
      theme: { color: '#0AA98C' },
      handler: (res: RazorpayResponse) => {
        call('verifyBoostPayment', {
          orderId: res.razorpay_order_id,
          paymentId: res.razorpay_payment_id,
          signature: res.razorpay_signature,
        })
          .then(() => resolve('paid'))
          .catch(reject);
      },
      modal: { ondismiss: () => resolve('cancelled') },
    });
    rzp.on('payment.failed', (e) => reject(new Error(e.error?.description ?? 'Payment failed')));
    rzp.open();
  });
}

/* -------------------------------- admin --------------------------------- */

export const adminApi = {
  stats: () => call<AdminStats>('adminStats'),
  reports: async (status: 'open' | 'resolved') => {
    const res = await call<{ reports: (AdminReport & { target: { seller?: DocumentData; ad?: DocumentData } })[] }>(
      'adminReports',
      { status },
    );
    return {
      reports: res.reports.map((r) => ({
        ...r,
        target: {
          ...r.target,
          ad: r.target.ad ? toAd(String(r.target.ad.id), r.target.ad) : undefined,
          seller: r.target.seller
            ? { ...toSeller(String(r.target.seller.id), r.target.seller), banned: !!r.target.seller.banned }
            : undefined,
        },
      })) as AdminReport[],
    };
  },
  resolve: (id: string, action: ResolveAction) => call('adminResolve', { reportId: id, action }),
  unban: (id: string) => call('adminUnban', { uid: id }),
};

/* ---------------------------- pushes from actions ---------------------------- */

const pendingChats = new Map<string, Promise<void>>();

async function uploadImages(images: string[]): Promise<string[]> {
  const { storage, auth } = init();
  const me = auth.currentUser!.uid;
  return Promise.all(
    images.map(async (src) => {
      if (!src.startsWith('data:')) return src;
      const ext = /^data:image\/(png|webp)/.exec(src)?.[1] ?? 'jpg';
      const r = storageRef(storage, `ads/${me}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
      await uploadString(r, src, 'data_url');
      return getDownloadURL(r);
    }),
  );
}

const adFields = (a: Partial<Ad>) => ({
  title: a.title,
  description: a.description,
  price: a.price,
  category: a.category,
  condition: a.condition,
  area: a.area,
  city: a.city,
  distanceKm: a.distanceKm,
  negotiable: a.negotiable,
  delivery: a.delivery,
  status: a.status,
  attributes: a.attributes,
  priceHistory: a.priceHistory,
  createdAt: a.createdAt,
});

const signedIn = () => !!fb?.auth.currentUser;

export const remote = {
  get enabled() {
    return signedIn();
  },

  chatIdFor(adId: string): string | undefined {
    return uid ? `${adId}_${uid}` : undefined;
  },

  logout() {
    if (fb) void signOut(fb.auth);
  },

  setArea(area: string) {
    if (uid) void updateDoc(doc(init().db, 'users', uid), { area }).catch(() => undefined);
  },

  favorite(id: string, on: boolean) {
    if (!uid) return;
    const ref = doc(init().db, 'users', uid, 'favorites', id);
    (on ? setDoc(ref, { adId: id, createdAt: Date.now() }) : deleteDoc(ref)).catch((e) =>
      fail(e, "Couldn't update favourites"),
    );
  },

  view(id: string) {
    const ad = useStore.getState().ads.find((a) => a.id === id);
    if (!uid || !ad || ad.sellerId === 'me' || !['active', 'sold'].includes(ad.status)) return;
    void updateDoc(doc(init().db, 'ads', id), { views: increment(1) }).catch(() => undefined);
  },

  createAd(ad: Ad) {
    if (!uid) return;
    const me = uid;
    (async () => {
      const images = await uploadImages(ad.images);
      await setDoc(doc(init().db, 'ads', ad.id), {
        ...adFields(ad),
        description: ad.description ?? '',
        images,
        sellerId: me,
        views: 0,
        saves: 0,
        featured: false,
        boosted: false,
        status: ad.status === 'draft' ? 'draft' : 'active',
      });
    })().catch((e) => fail(e, "Couldn't publish your ad — it's saved on this device"));
  },

  updateAd(id: string, patch: Partial<Ad>) {
    if (!uid) return;
    (async () => {
      const images = patch.images ? await uploadImages(patch.images) : undefined;
      const fields = Object.fromEntries(
        Object.entries({ ...adFields(patch), ...(images ? { images } : {}) }).filter(([, v]) => v !== undefined),
      );
      if (fields.status === 'pending' || fields.status === 'removed') delete fields.status;
      await updateDoc(doc(init().db, 'ads', id), fields);
    })().catch((e) => fail(e, "Couldn't save your changes"));
  },

  deleteAd(id: string) {
    if (uid) deleteDoc(doc(init().db, 'ads', id)).catch((e) => fail(e, "Couldn't delete the ad"));
  },

  boostAd(id: string) {
    if (uid) call('freeBoost', { adId: id }).catch((e) => fail(e, "Couldn't activate the boost"));
  },

  dropPrice(id: string, price: number) {
    if (!uid) return;
    const ad = useStore.getState().ads.find((a) => a.id === id);
    void updateDoc(doc(init().db, 'ads', id), {
      price,
      ...(ad?.priceHistory ? { priceHistory: ad.priceHistory } : {}),
    }).catch((e) => fail(e, "Couldn't update the price"));
  },

  startChat(chatId: string, adId: string) {
    if (!uid) return;
    const me = uid;
    const ad = useStore.getState().ads.find((a) => a.id === adId);
    if (!ad) return;
    const sellerId = remoteId(ad.sellerId);
    const ref = doc(init().db, 'chats', chatId);
    pendingChats.set(
      chatId,
      getDoc(ref)
        .catch(() => null)
        .then(async (snap) => {
          if (snap?.exists()) return;
          await setDoc(ref, {
            adId,
            buyerId: me,
            sellerId,
            participants: [me, sellerId],
            createdAt: Date.now(),
            lastMessageAt: Date.now(),
          });
        })
        .catch((e) => fail(e, "Couldn't open the conversation")),
    );
  },

  sendMessage(chatId: string, msg: Message) {
    if (!uid) return;
    const me = uid;
    const offerAmount =
      msg.kind === 'offer' ? Number(msg.text.match(/₹([\d,]+)/)?.[1]?.replace(/,/g, '')) || undefined : undefined;
    (pendingChats.get(chatId) ?? Promise.resolve())
      .then(() =>
        setDoc(doc(init().db, 'chats', chatId, 'messages', msg.id), {
          senderId: me,
          text: msg.text,
          kind: msg.kind ?? 'text',
          offerAmount,
          createdAt: msg.createdAt,
          readAt: null,
        }),
      )
      .catch((e) => fail(e, 'Message not sent — check your connection'));
  },

  markChatRead(chatId: string) {
    if (!uid) return;
    const chat = useStore.getState().chats.find((c) => c.id === chatId);
    const unread = chat?.messages.filter((m) => m.senderId !== 'me') ?? [];
    if (!unread.length) return;
    const batch = writeBatch(init().db);
    unread.forEach((m) => batch.update(doc(init().db, 'chats', chatId, 'messages', m.id), { readAt: Date.now() }));
    void batch.commit().catch(() => undefined);
  },

  markNotificationsRead(id?: string) {
    if (!uid) return;
    const me = uid;
    const ids = id ? [id] : useStore.getState().notifications.map((n) => n.id);
    const batch = writeBatch(init().db);
    ids.forEach((n) => batch.update(doc(init().db, 'users', me, 'notifications', n), { read: true }));
    void batch.commit().catch(() => undefined);
  },

  addReview(localId: string, sellerId: string, rating: number, text: string) {
    if (!uid) return;
    const me = uid;
    const author = useStore.getState().user?.name ?? 'Bazaar user';
    setDoc(doc(init().db, 'reviews', `${sellerId}_${me}`), {
      sellerId,
      authorId: me,
      authorName: author,
      rating,
      text,
      createdAt: Date.now(),
    })
      .then(() => useStore.setState((s) => ({ reviews: s.reviews.filter((r) => r.id !== localId) })))
      .catch((e) => {
        useStore.setState((s) => ({ reviews: s.reviews.filter((r) => r.id !== localId) }));
        fail(e, 'You have already reviewed this seller');
      });
  },

  report(targetType: 'ad' | 'seller', targetId: string, reason: string) {
    if (!uid) return;
    void addDoc(collection(init().db, 'reports'), {
      reporterId: uid,
      targetType,
      targetId: remoteId(targetId),
      reason,
      status: 'open',
      createdAt: Date.now(),
    }).catch(() => undefined);
  },

  setBlocked(sellerId: string, on: boolean) {
    if (!uid) return;
    const ref = doc(init().db, 'users', uid, 'blocks', sellerId);
    (on ? setDoc(ref, { createdAt: Date.now() }) : deleteDoc(ref)).catch((e) =>
      fail(e, "Couldn't update the block list"),
    );
  },

  resetDemo() {
    /* Live data comes from Firestore — nothing to reset locally. */
  },
};
