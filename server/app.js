import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tx } from './db.js';

/* ----------------------------------------------------------------------------
 * Bazaar REST API — zero dependencies (node:http + node:sqlite).
 * Every response is JSON. Auth is a bearer token from POST /api/auth/verify.
 * ------------------------------------------------------------------------- */

const DAY = 86_400_000;
const SESSION_TTL = 60 * DAY;
const OTP_TTL = 5 * 60_000;
const OTP_RESEND_MS = 20_000;
const OTP_MAX_PER_HOUR = 6;
const OTP_MAX_ATTEMPTS = 5;
const MAX_BODY = 8 * 1024 * 1024;
const MAX_UPLOAD = 4 * 1024 * 1024;
const BOOST_DAYS = 7;
const BOOST_PRICE_PAISE = 14_900; // ₹149
const STREAM_PING_MS = 25_000;
const AUTO_REVIEW_REPORTS = 3; // distinct reporters before an ad is hidden for review
const RESOLVE_ACTIONS = new Set(['dismiss', 'remove', 'ban', 'restore']);

const CATEGORIES = new Set([
  'cars', 'mobiles', 'properties', 'bikes', 'electronics', 'furniture',
  'fashion', 'jobs', 'pets', 'services', 'sports', 'books',
]);
const CONDITIONS = new Set(['new', 'like-new', 'good', 'fair']);
const STATUSES = new Set(['active', 'sold', 'draft']);
const MESSAGE_KINDS = new Set(['text', 'offer']);
const REPORT_TYPES = new Set(['ad', 'seller']);
const AVATAR_COLORS = ['#0AA98C', '#8B5CF6', '#F59E0B', '#DB2777', '#2563EB', '#EA580C', '#16A34A'];
const DEMO_REPLIES = [
  'Yes, it is still available. When would you like to see it?',
  'I can do a small discount for a quick pickup. Cash or UPI both work.',
  'Sure — I am free after 6pm today. You can inspect it properly before paying.',
  'Thanks for reaching out! Please share your preferred time and I will keep it ready.',
];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const newId = (prefix) => `${prefix}-${randomBytes(9).toString('base64url')}`;
const CLIENT_ID = /^[A-Za-z0-9_-]{3,64}$/;

/* --------------------------------- helpers -------------------------------- */

function str(v, field, { min = 0, max = 200, optional = false } = {}) {
  if (v === undefined || v === null) {
    if (optional) return undefined;
    throw bad(`${field} is required`);
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  const t = v.trim();
  if (t.length < min) throw bad(`${field} must be at least ${min} characters`);
  if (t.length > max) throw bad(`${field} must be at most ${max} characters`);
  return t;
}
function int(v, field, { min = 0, max = 1e10, optional = false } = {}) {
  if (v === undefined || v === null) {
    if (optional) return undefined;
    throw bad(`${field} is required`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || Math.round(n) !== n) throw bad(`${field} must be a whole number`);
  if (n < min || n > max) throw bad(`${field} must be between ${min} and ${max}`);
  return n;
}
function oneOf(v, set, field, optional = false) {
  if (v === undefined && optional) return undefined;
  if (!set.has(v)) throw bad(`${field} is not valid`);
  return v;
}

/** Normalises Indian mobile numbers to +91XXXXXXXXXX. */
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw bad('Enter a valid 10-digit Indian mobile number');
  return `+91${local}`;
}

const prettyPhone = (p) => (p ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : '');

/* ------------------------------- serializers ------------------------------ */

function adOut(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category,
    condition: row.condition,
    images: JSON.parse(row.images),
    area: row.area,
    city: row.city,
    distanceKm: row.distance_km,
    sellerId: row.seller_id,
    createdAt: row.created_at,
    views: row.views,
    saves: row.saves,
    featured: !!row.featured,
    boosted: !!row.boosted && (row.boosted_until == null || row.boosted_until > Date.now()),
    ...(row.boosted_until ? { boostedUntil: row.boosted_until } : {}),
    negotiable: !!row.negotiable,
    delivery: !!row.delivery,
    status: row.status,
    attributes: JSON.parse(row.attributes),
    ...(row.warranty ? { warranty: row.warranty } : {}),
    ...(row.price_history ? { priceHistory: JSON.parse(row.price_history) } : {}),
  };
}

function sellerOut(u) {
  return {
    id: u.id,
    name: u.name || 'Bazaar user',
    phone: prettyPhone(u.phone),
    avatarColor: u.avatar_color,
    rating: Math.round(u.rating * 10) / 10,
    reviews: u.reviews_count,
    joined: String(new Date(u.created_at).getUTCFullYear()),
    verified: !!u.verified,
    responseRate: u.response_rate,
    responseTime: u.response_time,
    ...(u.bio ? { bio: u.bio } : {}),
  };
}

function meOut(u) {
  return {
    id: u.id,
    name: u.name,
    phone: prettyPhone(u.phone),
    area: u.area,
    avatarColor: u.avatar_color,
    joined: u.created_at,
    role: u.role === 'admin' ? 'admin' : 'user',
  };
}

const messageOut = (m) => ({
  id: m.id,
  chatId: m.chat_id,
  senderId: m.sender_id,
  text: m.text,
  kind: m.kind,
  ...(m.offer_amount != null ? { offerAmount: m.offer_amount } : {}),
  createdAt: m.created_at,
  read: m.read_at != null,
});

const reviewOut = (r) => ({
  id: r.id,
  sellerId: r.seller_id,
  authorId: r.author_id,
  authorName: r.author_name,
  rating: r.rating,
  text: r.text,
  createdAt: r.created_at,
});

const notificationOut = (n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  ...(n.href ? { href: n.href } : {}),
  createdAt: n.created_at,
  read: !!n.read,
});

/* ---------------------------------- app ----------------------------------- */

/**
 * @param {object} opts
 * @param {import('node:sqlite').DatabaseSync} opts.db
 * @param {string} [opts.otpSecret]      pepper for OTP hashes
 * @param {string} [opts.devOtpCode]     fixed code returned to the client (dev/demo only)
 * @param {(phone: string, code: string) => Promise<void>} [opts.sendSms]
 * @param {string} [opts.uploadsDir]
 * @param {string} [opts.publicUrl]      base URL used for uploaded image links
 * @param {string[]|'*'} [opts.corsOrigins]
 * @param {number|false} [opts.demoReplyMs] auto-reply delay for seeded demo sellers; false disables
 * @param {() => number} [opts.now]
 */
export function createApp(opts) {
  const {
    db,
    otpSecret = 'bazaar-dev-secret',
    devOtpCode,
    sendSms,
    uploadsDir = resolve('server/data/uploads'),
    publicUrl,
    corsOrigins = '*',
    demoReplyMs = 1800,
    adminPhones = [],
    payments,
    now = Date.now,
  } = opts;
  mkdirSync(uploadsDir, { recursive: true });
  const timers = new Set();

  const q = (sql) => db.prepare(sql);
  const userById = (id) => q('SELECT * FROM users WHERE id = ?').get(id);
  const adById = (id) => q('SELECT * FROM ads WHERE id = ?').get(id);

  /* ---- live updates (server-sent events) ---- */
  const streams = new Map(); // userId -> Set<ServerResponse>
  function pushTo(userId, event, data) {
    for (const res of streams.get(userId) ?? []) {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        /* closed */
      }
    }
  }

  function notify(userId, type, title, body, href) {
    const id = newId('n');
    q(`INSERT INTO notifications (id, user_id, type, title, body, href, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, userId, type, title, body, href ?? null, now());
    pushTo(userId, 'update', { type, id });
  }

  function userForToken(token) {
    if (!token) return null;
    const s = q('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token));
    if (!s || s.expires_at < now()) return null;
    const u = userById(s.user_id);
    return u && !u.banned ? u : null;
  }

  function authUser(req) {
    const header = req.headers.authorization ?? '';
    return userForToken(header.startsWith('Bearer ') ? header.slice(7).trim() : '');
  }

  function requireAdmin(ctx) {
    const user = requireUser(ctx);
    if (user.role !== 'admin') throw new HttpError(403, 'Moderators only');
    return user;
  }

  /** Extends (or starts) a 7-day boost and tells the seller. */
  function applyBoost(adId) {
    const ad = adById(adId);
    if (!ad) return;
    const from = Math.max(now(), ad.boosted_until ?? 0);
    const until = from + BOOST_DAYS * DAY;
    q('UPDATE ads SET boosted = 1, featured = 1, boosted_until = ?, updated_at = ? WHERE id = ?').run(
      until, now(), ad.id,
    );
    notify(ad.seller_id, 'boost', `Boost active · ${BOOST_DAYS} days`,
      `“${ad.title}” is now featured at the top of nearby searches.`, `/ad/${ad.id}`);
  }

  function markPaid(orderId, paymentId) {
    const pay = q('SELECT * FROM payments WHERE order_id = ?').get(orderId);
    if (!pay) return null;
    if (pay.status !== 'paid') {
      tx(db, () => {
        q("UPDATE payments SET status = 'paid', payment_id = ?, paid_at = ? WHERE order_id = ?").run(
          paymentId, now(), orderId,
        );
        applyBoost(pay.ad_id);
      });
    }
    return q('SELECT * FROM payments WHERE order_id = ?').get(orderId);
  }

  const hmacHex = (secret, data) => createHmac('sha256', secret).update(data).digest('hex');
  const safeEqualHex = (a, b) => {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && timingSafeEqual(x, y);
  };

  async function createRazorpayOrder(amount, receipt, notes) {
    if (payments.createOrder) return payments.createOrder(amount, receipt, notes);
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${payments.keyId}:${payments.keySecret}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
    });
    if (!res.ok) throw new HttpError(502, 'Payment provider is unavailable — try again shortly');
    return res.json();
  }

  function requireUser(ctx) {
    if (!ctx.user) throw new HttpError(401, 'Sign in to continue');
    return ctx.user;
  }

  function ownAd(ctx, id) {
    const user = requireUser(ctx);
    const ad = adById(id);
    if (!ad) throw new HttpError(404, 'Ad not found');
    if (ad.seller_id !== user.id) throw new HttpError(403, 'You can only change your own ads');
    return ad;
  }

  function chatFor(ctx, id) {
    const user = requireUser(ctx);
    const chat = q('SELECT * FROM chats WHERE id = ?').get(id);
    if (!chat || (chat.buyer_id !== user.id && chat.seller_id !== user.id))
      throw new HttpError(404, 'Conversation not found');
    return chat;
  }

  function chatOut(chat, userId) {
    const messages = q('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at, rowid')
      .all(chat.id)
      .map(messageOut);
    return {
      id: chat.id,
      adId: chat.ad_id,
      buyerId: chat.buyer_id,
      sellerId: chat.seller_id,
      counterpartId: chat.buyer_id === userId ? chat.seller_id : chat.buyer_id,
      messages,
      lastMessageAt: chat.last_message_at,
    };
  }

  function isBlocked(a, b) {
    return !!q(
      `SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)`,
    ).get(a, b, b, a);
  }

  function insertMessage(chat, senderId, text, kind = 'text', offerAmount = null, id) {
    const at = now();
    const msgId = id && CLIENT_ID.test(id) && !q('SELECT 1 FROM messages WHERE id = ?').get(id)
      ? id
      : newId('m');
    q(`INSERT INTO messages (id, chat_id, sender_id, text, kind, offer_amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(msgId, chat.id, senderId, text, kind, offerAmount, at);
    q('UPDATE chats SET last_message_at = ? WHERE id = ?').run(at, chat.id);
    const recipient = senderId === chat.buyer_id ? chat.seller_id : chat.buyer_id;
    const sender = userById(senderId);
    const first = (sender?.name || 'Someone').split(' ')[0];
    notify(
      recipient,
      'chat',
      kind === 'offer' ? `${first} sent an offer` : `${first} sent a message`,
      text.slice(0, 140),
      `/chats/${chat.id}`,
    );
    return q('SELECT * FROM messages WHERE id = ?').get(msgId);
  }

  function scheduleDemoReply(chat, fromUserId) {
    if (demoReplyMs === false) return;
    const other = fromUserId === chat.buyer_id ? chat.seller_id : chat.buyer_id;
    const u = userById(other);
    if (!u?.is_demo) return;
    const t = setTimeout(() => {
      timers.delete(t);
      try {
        if (!q('SELECT 1 FROM chats WHERE id = ?').get(chat.id) || isBlocked(other, fromUserId)) return;
        insertMessage(chat, other, DEMO_REPLIES[randomInt(DEMO_REPLIES.length)]);
      } catch {
        /* database closed (shutdown/tests) */
      }
    }, demoReplyMs + randomInt(Math.max(1, Math.round(demoReplyMs / 2))));
    t.unref?.();
    timers.add(t);
  }

  function blockedIds(userId) {
    if (!userId) return [];
    return q('SELECT blocked_id FROM blocks WHERE user_id = ?').all(userId).map((r) => r.blocked_id);
  }

  function originFor(req) {
    if (publicUrl) return publicUrl.replace(/\/$/, '');
    const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0];
    return `${proto}://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
  }

  /* --------------------------------- routes -------------------------------- */

  const routes = [];
  const route = (method, path, handler) => {
    const keys = [];
    const re = new RegExp(
      '^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$',
    );
    routes.push({ method, re, keys, handler });
  };

  route('GET', '/api/health', () => ({ ok: true, time: now() }));

  /* ---- auth ---- */

  route('POST', '/api/auth/otp', async (ctx) => {
    const phone = normalizePhone(ctx.body.phone);
    const t = now();
    const existing = q('SELECT * FROM otps WHERE phone = ?').get(phone);
    if (existing && t - existing.last_sent_at < OTP_RESEND_MS)
      throw new HttpError(429, 'Please wait a few seconds before requesting another code');
    let windowStart = t;
    let sent = 1;
    if (existing && t - existing.window_start < 3_600_000) {
      if (existing.sent_in_window >= OTP_MAX_PER_HOUR)
        throw new HttpError(429, 'Too many codes requested — try again in an hour');
      windowStart = existing.window_start;
      sent = existing.sent_in_window + 1;
    }
    const code = devOtpCode ?? String(randomInt(1000, 10000));
    if (!devOtpCode) {
      if (!sendSms) throw new HttpError(503, 'SMS sending is not configured on this server');
      await sendSms(phone, code);
    }
    q(`INSERT INTO otps (phone, code_hash, expires_at, attempts, last_sent_at, window_start, sent_in_window)
       VALUES (?, ?, ?, 0, ?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
         attempts = 0, last_sent_at = excluded.last_sent_at, window_start = excluded.window_start,
         sent_in_window = excluded.sent_in_window`).run(
      phone, sha256(`${otpSecret}:${phone}:${code}`), t + OTP_TTL, t, windowStart, sent,
    );
    return { sent: true, expiresIn: OTP_TTL / 1000, ...(devOtpCode ? { devCode: code } : {}) };
  });

  route('POST', '/api/auth/verify', (ctx) => {
    const phone = normalizePhone(ctx.body.phone);
    const code = String(ctx.body.code ?? '').replace(/\D/g, '');
    const otp = q('SELECT * FROM otps WHERE phone = ?').get(phone);
    if (!otp || otp.expires_at < now()) throw bad('Code expired — request a new one');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong codes — request a new one');
    const expected = Buffer.from(otp.code_hash, 'hex');
    const got = Buffer.from(sha256(`${otpSecret}:${phone}:${code}`), 'hex');
    if (!timingSafeEqual(expected, got)) {
      q('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?').run(phone);
      throw bad('That code is not right');
    }
    q('DELETE FROM otps WHERE phone = ?').run(phone);

    let user = q('SELECT * FROM users WHERE phone = ?').get(phone);
    if (user?.banned) throw new HttpError(403, 'This account has been suspended');
    const isNew = !user;
    if (!user) {
      const id = newId('usr');
      q(`INSERT INTO users (id, phone, name, area, avatar_color, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
        id,
        phone,
        str(ctx.body.name, 'name', { max: 40, optional: true }) ?? '',
        str(ctx.body.area, 'area', { max: 40, optional: true }) ?? 'Salt Lake',
        AVATAR_COLORS[randomInt(AVATAR_COLORS.length)],
        now(),
      );
      user = userById(id);
    }
    if (adminPhones.includes(phone) && user.role !== 'admin') {
      q("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
      user = userById(user.id);
    }
    const token = randomBytes(32).toString('base64url');
    q('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      sha256(token), user.id, now(), now() + SESSION_TTL,
    );
    return { token, user: meOut(user), isNew };
  });

  route('POST', '/api/auth/logout', (ctx) => {
    const token = (ctx.req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (token) q('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    return { ok: true };
  });

  route('GET', '/api/me', (ctx) => ({ user: meOut(requireUser(ctx)) }));

  route('PATCH', '/api/me', (ctx) => {
    const user = requireUser(ctx);
    const name = str(ctx.body.name, 'name', { min: 1, max: 40, optional: true });
    const area = str(ctx.body.area, 'area', { min: 1, max: 40, optional: true });
    q('UPDATE users SET name = COALESCE(?, name), area = COALESCE(?, area) WHERE id = ?').run(
      name ?? null, area ?? null, user.id,
    );
    return { user: meOut(userById(user.id)) };
  });

  /* ---- bootstrap & polling ---- */

  route('GET', '/api/bootstrap', (ctx) => {
    const me = ctx.user;
    const blocked = blockedIds(me?.id);
    const ads = q(
      `SELECT * FROM ads WHERE status IN ('active', 'sold') OR seller_id = ?
       ORDER BY created_at DESC LIMIT 500`,
    )
      .all(me?.id ?? '')
      .filter((a) => !blocked.includes(a.seller_id))
      .map(adOut);
    const chats = me
      ? q('SELECT * FROM chats WHERE buyer_id = ? OR seller_id = ? ORDER BY last_message_at DESC')
          .all(me.id, me.id)
          .map((c) => chatOut(c, me.id))
      : [];
    const sellerIds = new Set([
      ...ads.map((a) => a.sellerId),
      ...chats.map((c) => c.counterpartId),
      ...blocked,
    ]);
    const sellers = [...sellerIds].map(userById).filter(Boolean).map(sellerOut);
    return {
      now: now(),
      me: me ? meOut(me) : null,
      ads,
      sellers,
      reviews: q('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 500').all().map(reviewOut),
      favorites: me
        ? q('SELECT ad_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC').all(me.id).map((r) => r.ad_id)
        : [],
      chats,
      notifications: me
        ? q('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(me.id).map(notificationOut)
        : [],
      blocked,
      config: {
        payments: !!payments,
        boostPricePaise: BOOST_PRICE_PAISE,
        boostDays: BOOST_DAYS,
      },
    };
  });

  /** Lightweight polling: everything that changed for this user since `since`. */
  route('GET', '/api/updates', (ctx) => {
    const me = requireUser(ctx);
    const since = int(ctx.query.get('since') ?? 0, 'since', { max: 1e15 });
    const chats = q(
      `SELECT * FROM chats WHERE (buyer_id = ? OR seller_id = ?) AND last_message_at > ?`,
    ).all(me.id, me.id, since);
    const notifications = q(
      'SELECT * FROM notifications WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC',
    ).all(me.id, since);
    const sellers = chats
      .map((c) => (c.buyer_id === me.id ? c.seller_id : c.buyer_id))
      .map(userById)
      .filter(Boolean)
      .map(sellerOut);
    return {
      now: now(),
      chats: chats.map((c) => chatOut(c, me.id)),
      notifications: notifications.map(notificationOut),
      sellers,
    };
  });

  /* ---- ads ---- */

  route('GET', '/api/ads', (ctx) => {
    const p = ctx.query;
    const where = ["status = 'active'"];
    const args = [];
    const text = p.get('q')?.trim();
    if (text) {
      for (const token of text.toLowerCase().split(/\s+/).slice(0, 6)) {
        where.push('(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(area) LIKE ?)');
        args.push(`%${token}%`, `%${token}%`, `%${token}%`);
      }
    }
    if (p.get('cat')) { where.push('category = ?'); args.push(p.get('cat')); }
    if (p.get('min')) { where.push('price >= ?'); args.push(Number(p.get('min'))); }
    if (p.get('max')) { where.push('price <= ?'); args.push(Number(p.get('max'))); }
    if (p.get('seller')) { where.push('seller_id = ?'); args.push(p.get('seller')); }
    const blocked = blockedIds(ctx.user?.id);
    if (blocked.length) {
      where.push(`seller_id NOT IN (${blocked.map(() => '?').join(',')})`);
      args.push(...blocked);
    }
    const order = {
      newest: 'created_at DESC',
      'price-asc': 'price ASC',
      'price-desc': 'price DESC',
      distance: 'distance_km ASC',
    }[p.get('sort')] ?? 'featured DESC, saves DESC';
    const limit = Math.min(100, Number(p.get('limit')) || 40);
    const offset = Math.max(0, Number(p.get('offset')) || 0);
    const rows = q(`SELECT * FROM ads WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...args, limit, offset);
    const { n } = q(`SELECT COUNT(*) AS n FROM ads WHERE ${where.join(' AND ')}`).get(...args);
    return { ads: rows.map(adOut), total: n };
  });

  route('GET', '/api/ads/:id', (ctx) => {
    const ad = adById(ctx.params.id);
    const publicStatus = ad?.status === 'active' || ad?.status === 'sold';
    if (!ad || (!publicStatus && ad.seller_id !== ctx.user?.id))
      throw new HttpError(404, 'Ad not found');
    return { ad: adOut(ad), seller: sellerOut(userById(ad.seller_id)) };
  });

  route('POST', '/api/ads/:id/view', (ctx) => {
    const ad = adById(ctx.params.id);
    if (!ad) throw new HttpError(404, 'Ad not found');
    if (ad.seller_id !== ctx.user?.id) q('UPDATE ads SET views = views + 1 WHERE id = ?').run(ad.id);
    return { views: adById(ad.id).views };
  });

  function readAdFields(b, partial) {
    const opt = { optional: partial };
    const f = {
      title: str(b.title, 'title', { min: 8, max: 70, ...opt }),
      description: str(b.description, 'description', { max: 1200, optional: true }),
      price: int(b.price, 'price', { min: 0, max: 1_000_000_000, ...opt }),
      category: oneOf(b.category, CATEGORIES, 'category', partial),
      condition: oneOf(b.condition, CONDITIONS, 'condition', partial),
      area: str(b.area, 'area', { min: 2, max: 40, ...opt }),
      status: oneOf(b.status, STATUSES, 'status', true),
      negotiable: b.negotiable === undefined ? undefined : !!b.negotiable,
      delivery: b.delivery === undefined ? undefined : !!b.delivery,
    };
    if (b.images !== undefined) {
      if (!Array.isArray(b.images) || b.images.length > 6) throw bad('images must be a list of up to 6 URLs');
      for (const u of b.images) {
        if (typeof u !== 'string' || u.length > 500 || !/^(https?:\/\/|\/)/.test(u))
          throw bad('Upload photos first, then send their URLs');
      }
      f.images = b.images;
    }
    if (b.attributes !== undefined) {
      if (typeof b.attributes !== 'object' || Array.isArray(b.attributes) || b.attributes === null)
        throw bad('attributes must be an object');
      const entries = Object.entries(b.attributes).slice(0, 20)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k.slice(0, 30), v.slice(0, 80)]);
      f.attributes = Object.fromEntries(entries);
    }
    if (b.distanceKm !== undefined) {
      const d = Number(b.distanceKm);
      f.distanceKm = Number.isFinite(d) && d >= 0 && d < 100 ? d : 1;
    }
    return f;
  }

  route('POST', '/api/ads', (ctx) => {
    const user = requireUser(ctx);
    const f = readAdFields(ctx.body, false);
    if (f.status === 'sold') f.status = 'active';
    const id = typeof ctx.body.id === 'string' && CLIENT_ID.test(ctx.body.id) && !adById(ctx.body.id)
      ? ctx.body.id
      : newId('ad');
    const t = now();
    q(`INSERT INTO ads (id, seller_id, title, description, price, category, condition, images, area,
        distance_km, negotiable, delivery, status, attributes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, user.id, f.title, f.description ?? '', f.price, f.category, f.condition,
      JSON.stringify(f.images ?? []), f.area, f.distanceKm ?? 1, f.negotiable ? 1 : 0,
      f.delivery ? 1 : 0, f.status ?? 'active', JSON.stringify(f.attributes ?? {}), t, t,
    );
    return { ad: adOut(adById(id)) };
  });

  route('PATCH', '/api/ads/:id', (ctx) => {
    const ad = ownAd(ctx, ctx.params.id);
    if (ad.status === 'pending' || ad.status === 'removed')
      throw new HttpError(423, ad.status === 'pending'
        ? 'This ad is under review — you can edit it once our team has checked it'
        : 'This ad was removed by moderators and can no longer be changed');
    const f = readAdFields(ctx.body, true);
    if (f.status === 'active' && ad.status === 'draft') {
      const title = f.title ?? ad.title;
      if (title.length < 8 || !((f.price ?? ad.price) > 0)) throw bad('Add a title and price before publishing');
    }
    tx(db, () => {
      const sets = [];
      const args = [];
      const col = { title: 'title', description: 'description', price: 'price', category: 'category',
        condition: 'condition', area: 'area', status: 'status', distanceKm: 'distance_km' };
      for (const [k, c] of Object.entries(col)) {
        if (f[k] !== undefined) { sets.push(`${c} = ?`); args.push(f[k]); }
      }
      if (f.negotiable !== undefined) { sets.push('negotiable = ?'); args.push(f.negotiable ? 1 : 0); }
      if (f.delivery !== undefined) { sets.push('delivery = ?'); args.push(f.delivery ? 1 : 0); }
      if (f.images !== undefined) { sets.push('images = ?'); args.push(JSON.stringify(f.images)); }
      if (f.attributes !== undefined) { sets.push('attributes = ?'); args.push(JSON.stringify(f.attributes)); }
      // A draft going live counts as freshly posted.
      if (f.status === 'active' && ad.status === 'draft') { sets.push('created_at = ?'); args.push(now()); }
      // Price drops are recorded and announced to everyone watching the ad.
      if (f.price !== undefined && f.price < ad.price && ad.status !== 'draft') {
        const history = ad.price_history ? JSON.parse(ad.price_history) : [{ price: ad.price, at: ad.created_at }];
        history.push({ price: f.price, at: now() });
        sets.push('price_history = ?');
        args.push(JSON.stringify(history.slice(-20)));
        const pct = Math.round(((ad.price - f.price) / ad.price) * 100);
        for (const { user_id } of q('SELECT user_id FROM favorites WHERE ad_id = ?').all(ad.id)) {
          notify(user_id, 'price', `Price dropped ${pct}%`,
            `“${ad.title}” is now ₹${f.price.toLocaleString('en-IN')}.`, `/ad/${ad.id}`);
        }
      }
      sets.push('updated_at = ?');
      args.push(now());
      q(`UPDATE ads SET ${sets.join(', ')} WHERE id = ?`).run(...args, ad.id);
    });
    return { ad: adOut(adById(ad.id)) };
  });

  route('DELETE', '/api/ads/:id', (ctx) => {
    const ad = ownAd(ctx, ctx.params.id);
    q('DELETE FROM ads WHERE id = ?').run(ad.id);
    return { ok: true };
  });

  /** Free boost — only while payments are not configured (demo / testing). */
  route('POST', '/api/ads/:id/boost', (ctx) => {
    const ad = ownAd(ctx, ctx.params.id);
    if (ad.status !== 'active') throw bad('Only live ads can be boosted');
    if (payments) throw new HttpError(402, 'Boosts are paid — start a payment first');
    applyBoost(ad.id);
    return { ad: adOut(adById(ad.id)) };
  });

  /* ---- payments (Razorpay) ---- */

  route('POST', '/api/ads/:id/boost/order', async (ctx) => {
    const ad = ownAd(ctx, ctx.params.id);
    if (ad.status !== 'active') throw bad('Only live ads can be boosted');
    if (!payments) throw bad('Payments are not set up on this server');
    const order = await createRazorpayOrder(BOOST_PRICE_PAISE, `boost_${ad.id}`.slice(0, 40), {
      adId: ad.id,
      userId: ctx.user.id,
    });
    q(`INSERT INTO payments (order_id, user_id, ad_id, purpose, amount, currency, created_at)
       VALUES (?, ?, ?, 'boost', ?, 'INR', ?)`).run(order.id, ctx.user.id, ad.id, BOOST_PRICE_PAISE, now());
    return {
      orderId: order.id,
      amount: BOOST_PRICE_PAISE,
      currency: 'INR',
      keyId: payments.keyId,
      description: `${BOOST_DAYS}-day boost · ${ad.title}`.slice(0, 80),
    };
  });

  /** Called by the app after Razorpay Checkout succeeds. */
  route('POST', '/api/payments/verify', (ctx) => {
    const me = requireUser(ctx);
    if (!payments) throw bad('Payments are not set up on this server');
    const orderId = str(ctx.body.orderId, 'orderId', { max: 64 });
    const paymentId = str(ctx.body.paymentId, 'paymentId', { max: 64 });
    const signature = str(ctx.body.signature, 'signature', { max: 128 });
    const pay = q('SELECT * FROM payments WHERE order_id = ? AND user_id = ?').get(orderId, me.id);
    if (!pay) throw new HttpError(404, 'Payment not found');
    if (!safeEqualHex(hmacHex(payments.keySecret, `${orderId}|${paymentId}`), signature))
      throw bad('Payment could not be verified');
    markPaid(orderId, paymentId);
    return { ad: adOut(adById(pay.ad_id)), status: 'paid' };
  });

  /**
   * Razorpay webhook (Dashboard → Webhooks → events payment.captured, order.paid).
   * Completes the boost even if the app was closed before verifying.
   */
  route('POST', '/api/payments/webhook', (ctx) => {
    if (!payments?.webhookSecret) throw new HttpError(404, 'Not found');
    const sig = ctx.req.headers['x-razorpay-signature'];
    if (!sig || !safeEqualHex(hmacHex(payments.webhookSecret, ctx.raw), sig))
      throw bad('Invalid signature');
    const event = ctx.body.event;
    const entity = ctx.body.payload?.payment?.entity;
    if ((event === 'payment.captured' || event === 'order.paid') && entity?.order_id) {
      markPaid(entity.order_id, entity.id);
    }
    return { ok: true };
  });

  route('PUT', '/api/ads/:id/favorite', (ctx) => {
    const user = requireUser(ctx);
    const ad = adById(ctx.params.id);
    if (!ad) throw new HttpError(404, 'Ad not found');
    tx(db, () => {
      const r = q('INSERT OR IGNORE INTO favorites (user_id, ad_id, created_at) VALUES (?, ?, ?)')
        .run(user.id, ad.id, now());
      if (r.changes) q('UPDATE ads SET saves = saves + 1 WHERE id = ?').run(ad.id);
    });
    return { saves: adById(ad.id).saves, favorite: true };
  });

  route('DELETE', '/api/ads/:id/favorite', (ctx) => {
    const user = requireUser(ctx);
    const ad = adById(ctx.params.id);
    if (!ad) throw new HttpError(404, 'Ad not found');
    tx(db, () => {
      const r = q('DELETE FROM favorites WHERE user_id = ? AND ad_id = ?').run(user.id, ad.id);
      if (r.changes) q('UPDATE ads SET saves = MAX(0, saves - 1) WHERE id = ?').run(ad.id);
    });
    return { saves: adById(ad.id).saves, favorite: false };
  });

  /* ---- uploads ---- */

  route('POST', '/api/uploads', (ctx) => {
    requireUser(ctx);
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(ctx.body.dataUrl ?? ''));
    if (!m) throw bad('Send a JPEG, PNG or WebP image as a data URL');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_UPLOAD) throw new HttpError(413, 'Image is too large (max 4 MB)');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const name = `${randomBytes(12).toString('base64url')}.${ext}`;
    writeFileSync(join(uploadsDir, name), buf);
    return { url: `${originFor(ctx.req)}/uploads/${name}` };
  });

  /* ---- chats ---- */

  route('GET', '/api/chats', (ctx) => {
    const me = requireUser(ctx);
    return {
      chats: q('SELECT * FROM chats WHERE buyer_id = ? OR seller_id = ? ORDER BY last_message_at DESC')
        .all(me.id, me.id)
        .map((c) => chatOut(c, me.id)),
    };
  });

  route('POST', '/api/chats', (ctx) => {
    const me = requireUser(ctx);
    const ad = adById(str(ctx.body.adId, 'adId', { max: 64 }));
    if (!ad || (ad.status !== 'active' && ad.status !== 'sold')) throw new HttpError(404, 'Ad not found');
    if (ad.seller_id === me.id) throw bad("You can't message yourself about your own ad");
    if (isBlocked(me.id, ad.seller_id)) throw new HttpError(403, 'You can no longer message this seller');
    let chat = q('SELECT * FROM chats WHERE ad_id = ? AND buyer_id = ?').get(ad.id, me.id);
    if (!chat) {
      const id = typeof ctx.body.id === 'string' && CLIENT_ID.test(ctx.body.id) &&
        !q('SELECT 1 FROM chats WHERE id = ?').get(ctx.body.id) ? ctx.body.id : newId('chat');
      q(`INSERT INTO chats (id, ad_id, buyer_id, seller_id, created_at, last_message_at)
         VALUES (?, ?, ?, ?, ?, ?)`).run(id, ad.id, me.id, ad.seller_id, now(), now());
      chat = q('SELECT * FROM chats WHERE id = ?').get(id);
    }
    return { chat: chatOut(chat, me.id), seller: sellerOut(userById(ad.seller_id)) };
  });

  route('POST', '/api/chats/:id/messages', (ctx) => {
    const me = requireUser(ctx);
    const chat = chatFor(ctx, ctx.params.id);
    const other = chat.buyer_id === me.id ? chat.seller_id : chat.buyer_id;
    if (isBlocked(me.id, other)) throw new HttpError(403, 'You can no longer message this person');
    const text = str(ctx.body.text, 'text', { min: 1, max: 2000 });
    const kind = oneOf(ctx.body.kind ?? 'text', MESSAGE_KINDS, 'kind');
    const offer = kind === 'offer' ? int(ctx.body.offerAmount, 'offerAmount', { min: 1, optional: true }) : undefined;
    const msg = insertMessage(chat, me.id, text, kind, offer ?? null, ctx.body.id);
    scheduleDemoReply(chat, me.id);
    return { message: messageOut(msg) };
  });

  route('POST', '/api/chats/:id/read', (ctx) => {
    const me = requireUser(ctx);
    const chat = chatFor(ctx, ctx.params.id);
    q('UPDATE messages SET read_at = ? WHERE chat_id = ? AND sender_id != ? AND read_at IS NULL')
      .run(now(), chat.id, me.id);
    return { ok: true };
  });

  /* ---- sellers & reviews ---- */

  route('GET', '/api/sellers/:id', (ctx) => {
    const u = userById(ctx.params.id);
    if (!u) throw new HttpError(404, 'Seller not found');
    return {
      seller: sellerOut(u),
      ads: q("SELECT * FROM ads WHERE seller_id = ? AND status = 'active' ORDER BY created_at DESC").all(u.id).map(adOut),
      reviews: q('SELECT * FROM reviews WHERE seller_id = ? ORDER BY created_at DESC').all(u.id).map(reviewOut),
    };
  });

  route('POST', '/api/sellers/:id/reviews', (ctx) => {
    const me = requireUser(ctx);
    const seller = userById(ctx.params.id);
    if (!seller) throw new HttpError(404, 'Seller not found');
    if (seller.id === me.id) throw bad("You can't review yourself");
    if (q('SELECT 1 FROM reviews WHERE seller_id = ? AND author_id = ?').get(seller.id, me.id))
      throw new HttpError(409, 'You have already reviewed this seller');
    const rating = int(ctx.body.rating, 'rating', { min: 1, max: 5 });
    const text = str(ctx.body.text, 'text', { min: 8, max: 400 });
    const id = newId('rv');
    tx(db, () => {
      q(`INSERT INTO reviews (id, seller_id, author_id, author_name, rating, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, seller.id, me.id, me.name || 'Bazaar user', rating, text, now());
      const total = seller.rating * seller.reviews_count + rating;
      const count = seller.reviews_count + 1;
      q('UPDATE users SET rating = ?, reviews_count = ? WHERE id = ?').run(total / count, count, seller.id);
      notify(seller.id, 'system', `New ${rating}★ review`, text.slice(0, 140), `/seller/${seller.id}`);
    });
    return { review: reviewOut(q('SELECT * FROM reviews WHERE id = ?').get(id)), seller: sellerOut(userById(seller.id)) };
  });

  /* ---- trust & safety ---- */

  route('POST', '/api/reports', (ctx) => {
    const me = requireUser(ctx);
    const targetType = oneOf(ctx.body.targetType, REPORT_TYPES, 'targetType');
    const targetId = str(ctx.body.targetId, 'targetId', { max: 64 });
    const reason = str(ctx.body.reason, 'reason', { min: 3, max: 200 });
    q(`INSERT INTO reports (id, reporter_id, target_type, target_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`).run(newId('rp'), me.id, targetType, targetId, reason, now());
    if (targetType === 'ad') {
      const ad = adById(targetId);
      const { n } = q(`SELECT COUNT(DISTINCT reporter_id) AS n FROM reports
        WHERE target_type = 'ad' AND target_id = ? AND status = 'open'`).get(targetId);
      if (ad?.status === 'active' && n >= AUTO_REVIEW_REPORTS) {
        q("UPDATE ads SET status = 'pending', updated_at = ? WHERE id = ?").run(now(), ad.id);
        notify(ad.seller_id, 'system', 'Your ad is under review',
          `“${ad.title}” was reported by several people and is hidden while our team checks it.`, '/myads');
      }
    }
    return { ok: true };
  });

  /* ---- moderation (admins only) ---- */

  function reportTarget(r) {
    if (r.target_type === 'ad') {
      const ad = adById(r.target_id);
      if (!ad) return { kind: 'ad', missing: true };
      const seller = userById(ad.seller_id);
      return { kind: 'ad', ad: adOut(ad), seller: seller ? { ...sellerOut(seller), banned: !!seller.banned } : null };
    }
    const u = userById(r.target_id);
    return u ? { kind: 'seller', seller: { ...sellerOut(u), banned: !!u.banned } } : { kind: 'seller', missing: true };
  }

  route('GET', '/api/admin/stats', (ctx) => {
    requireAdmin(ctx);
    const one = (sql) => Object.values(q(sql).get())[0];
    return {
      users: one('SELECT COUNT(*) FROM users WHERE is_demo = 0'),
      liveAds: one("SELECT COUNT(*) FROM ads WHERE status = 'active'"),
      underReview: one("SELECT COUNT(*) FROM ads WHERE status = 'pending'"),
      openReports: one("SELECT COUNT(*) FROM reports WHERE status = 'open'"),
      banned: one('SELECT COUNT(*) FROM users WHERE banned = 1'),
      revenuePaise: one("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid'"),
    };
  });

  route('GET', '/api/admin/reports', (ctx) => {
    requireAdmin(ctx);
    const status = ctx.query.get('status') === 'resolved' ? 'resolved' : 'open';
    const rows = q(
      status === 'open'
        ? "SELECT * FROM reports WHERE status = 'open' ORDER BY created_at DESC LIMIT 200"
        : "SELECT * FROM reports WHERE status != 'open' ORDER BY resolved_at DESC LIMIT 200",
    ).all();
    return {
      reports: rows.map((r) => {
        const reporter = userById(r.reporter_id);
        const { n } = q(`SELECT COUNT(DISTINCT reporter_id) AS n FROM reports
          WHERE target_type = ? AND target_id = ? AND status = 'open'`).get(r.target_type, r.target_id);
        return {
          id: r.id,
          targetType: r.target_type,
          targetId: r.target_id,
          reason: r.reason,
          createdAt: r.created_at,
          status: r.status,
          resolution: r.resolution,
          resolvedAt: r.resolved_at,
          reporterName: reporter?.name || 'Bazaar user',
          openReportsOnTarget: n,
          target: reportTarget(r),
        };
      }),
    };
  });

  route('POST', '/api/admin/reports/:id/resolve', (ctx) => {
    const admin = requireAdmin(ctx);
    const report = q('SELECT * FROM reports WHERE id = ?').get(ctx.params.id);
    if (!report) throw new HttpError(404, 'Report not found');
    const action = oneOf(ctx.body.action, RESOLVE_ACTIONS, 'action');
    const ad = report.target_type === 'ad' ? adById(report.target_id) : null;
    const userId = report.target_type === 'seller' ? report.target_id : ad?.seller_id;

    const close = (where, args, resolution) =>
      q(`UPDATE reports SET status = 'resolved', resolution = ?, resolved_at = ?, resolved_by = ?
         WHERE status = 'open' AND ${where}`).run(resolution, now(), admin.id, ...args);

    tx(db, () => {
      if (action === 'dismiss') {
        q(`UPDATE reports SET status = 'resolved', resolution = 'dismissed', resolved_at = ?, resolved_by = ?
           WHERE id = ?`).run(now(), admin.id, report.id);
        // Nothing else pending on a hidden ad → put it back.
        if (ad?.status === 'pending') {
          const { n } = q(`SELECT COUNT(*) AS n FROM reports
            WHERE target_type = 'ad' AND target_id = ? AND status = 'open'`).get(ad.id);
          if (!n) q("UPDATE ads SET status = 'active' WHERE id = ?").run(ad.id);
        }
      } else if (action === 'restore') {
        if (!ad) throw bad('Only ads can be restored');
        q("UPDATE ads SET status = 'active' WHERE id = ?").run(ad.id);
        close("target_type = 'ad' AND target_id = ?", [ad.id], 'restored');
        notify(ad.seller_id, 'system', 'Your ad is live again', `“${ad.title}” passed review.`, `/ad/${ad.id}`);
      } else if (action === 'remove') {
        if (!ad) throw bad('This report is not about an ad — ban the seller instead');
        q("UPDATE ads SET status = 'removed', boosted = 0, featured = 0 WHERE id = ?").run(ad.id);
        close("target_type = 'ad' AND target_id = ?", [ad.id], 'removed');
        notify(ad.seller_id, 'system', 'Your ad was removed',
          `“${ad.title}” broke Bazaar's posting rules and was taken down.`, '/myads');
      } else if (action === 'ban') {
        if (!userId) throw bad('Seller not found');
        const target = userById(userId);
        if (target?.role === 'admin') throw bad("Admins can't be banned here");
        q('UPDATE users SET banned = 1 WHERE id = ?').run(userId);
        q('DELETE FROM sessions WHERE user_id = ?').run(userId);
        q("UPDATE ads SET status = 'removed', boosted = 0, featured = 0 WHERE seller_id = ? AND status != 'removed'").run(userId);
        close("target_type = 'seller' AND target_id = ?", [userId], 'banned');
        close("target_type = 'ad' AND target_id IN (SELECT id FROM ads WHERE seller_id = ?)", [userId], 'banned');
        for (const res of streams.get(userId) ?? []) res.end();
      }
    });
    return { ok: true, target: reportTarget(report) };
  });

  route('POST', '/api/admin/users/:id/unban', (ctx) => {
    requireAdmin(ctx);
    const u = userById(ctx.params.id);
    if (!u) throw new HttpError(404, 'User not found');
    q('UPDATE users SET banned = 0 WHERE id = ?').run(u.id);
    return { ok: true };
  });

  route('PUT', '/api/blocks/:id', (ctx) => {
    const me = requireUser(ctx);
    if (ctx.params.id === me.id) throw bad("You can't block yourself");
    q('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)').run(me.id, ctx.params.id, now());
    return { blocked: blockedIds(me.id) };
  });

  route('DELETE', '/api/blocks/:id', (ctx) => {
    const me = requireUser(ctx);
    q('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?').run(me.id, ctx.params.id);
    return { blocked: blockedIds(me.id) };
  });

  /* ---- notifications ---- */

  route('POST', '/api/notifications/read', (ctx) => {
    const me = requireUser(ctx);
    if (ctx.body.id) q('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(String(ctx.body.id), me.id);
    else q('UPDATE notifications SET read = 1 WHERE user_id = ?').run(me.id);
    return { ok: true };
  });

  /* -------------------------------- handler -------------------------------- */

  function cors(req, res) {
    const origin = req.headers.origin;
    const allowed = corsOrigins === '*' ? '*' : origin && corsOrigins.includes(origin) ? origin : null;
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      if (allowed !== '*') res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  }

  function send(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  }

  function readBody(req) {
    return new Promise((resolveBody, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(new HttpError(413, 'Request is too large'));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        if (!chunks.length) return resolveBody({ body: {}, raw: '' });
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const parsed = JSON.parse(raw);
          resolveBody({ body: parsed && typeof parsed === 'object' ? parsed : {}, raw });
        } catch {
          reject(bad('Body must be valid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  function serveUpload(res, name) {
    if (!/^[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(name)) return send(res, 404, { error: 'Not found' });
    const file = join(uploadsDir, name);
    if (!existsSync(file)) return send(res, 404, { error: 'Not found' });
    const type = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[name.split('.').pop()];
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(readFileSync(file));
  }

  /**
   * GET /api/stream?token=… — server-sent events. Browsers' EventSource can't send headers,
   * so the session token comes in the query. Emits `update` whenever something new arrives
   * for the user; the app then fetches /api/updates.
   */
  function openStream(req, res, url) {
    const user = userForToken(url.searchParams.get('token') ?? '');
    if (!user) return send(res, 401, { error: 'Sign in to continue' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 3000\nevent: ready\ndata: {}\n\n`);
    const set = streams.get(user.id) ?? new Set();
    set.add(res);
    streams.set(user.id, set);
    const ping = setInterval(() => res.write(': ping\n\n'), STREAM_PING_MS);
    ping.unref?.();
    const done = () => {
      clearInterval(ping);
      set.delete(res);
      if (!set.size) streams.delete(user.id);
    };
    req.on('close', done);
    res.on('close', done);
  }

  async function handle(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url ?? '/', 'http://local');
    if (req.method === 'GET' && url.pathname.startsWith('/uploads/'))
      return serveUpload(res, url.pathname.slice('/uploads/'.length));
    if (req.method === 'GET' && url.pathname === '/api/stream') return openStream(req, res, url);

    const pathMatches = routes.filter((r) => r.re.test(url.pathname));
    const r = pathMatches.find((x) => x.method === req.method);
    if (!r) {
      return pathMatches.length
        ? send(res, 405, { error: 'Method not allowed' })
        : send(res, 404, { error: 'Not found' });
    }
    try {
      const m = r.re.exec(url.pathname);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const { body, raw } = ['POST', 'PUT', 'PATCH'].includes(req.method)
        ? await readBody(req)
        : { body: {}, raw: '' };
      const ctx = { req, params, query: url.searchParams, body, raw, user: authUser(req) };
      const data = await r.handler(ctx);
      send(res, 200, data);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error('[bazaar-api]', req.method, url.pathname, err);
      send(res, 500, { error: 'Something went wrong on our side' });
    }
  }

  handle.close = () => {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    for (const set of streams.values()) for (const res of set) res.end();
    streams.clear();
  };
  return handle;
}
