import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'Salt Lake',
  avatar_color TEXT NOT NULL DEFAULT '#0AA98C',
  bio TEXT,
  verified INTEGER NOT NULL DEFAULT 1,
  rating REAL NOT NULL DEFAULT 5,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  response_rate INTEGER NOT NULL DEFAULT 100,
  response_time TEXT NOT NULL DEFAULT 'within an hour',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS otps (
  phone TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  sent_in_window INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  area TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Kolkata',
  distance_km REAL NOT NULL DEFAULT 1,
  views INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  boosted INTEGER NOT NULL DEFAULT 0,
  negotiable INTEGER NOT NULL DEFAULT 0,
  delivery INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  attributes TEXT NOT NULL DEFAULT '{}',
  warranty TEXT,
  price_history TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ads_status_created ON ads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ads_seller ON ads(seller_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, ad_id)
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  UNIQUE (ad_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS chats_buyer ON chats(buyer_id);
CREATE INDEX IF NOT EXISTS chats_seller ON chats(seller_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  offer_amount INTEGER,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS messages_chat ON messages(chat_id, created_at);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_seller ON reviews(seller_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, created_at DESC);
`;

/** Opens (and if needed creates + seeds) the marketplace database. */
export function openDb(path = ':memory:', { seed = true, now = Date.now } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (seed && n === 0) seedDemo(db, now());
  return db;
}

/** Runs fn inside a transaction, rolling back if it throws. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedDemo(db, now) {
  const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
  tx(db, () => {
    const insUser = db.prepare(`INSERT INTO users
      (id, phone, name, area, avatar_color, bio, verified, rating, reviews_count,
       response_rate, response_time, is_demo, created_at)
      VALUES (?, ?, ?, 'Salt Lake', ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
    for (const s of seed.sellers) {
      const joined = Date.UTC(Number(s.joined) || 2022, 0, 15);
      insUser.run(
        s.id,
        s.phone.replace(/[^\d+]/g, ''),
        s.name,
        s.avatarColor,
        s.bio ?? null,
        s.verified ? 1 : 0,
        s.rating,
        s.reviews,
        s.responseRate,
        s.responseTime,
        joined,
      );
    }
    const insAd = db.prepare(`INSERT INTO ads
      (id, seller_id, title, description, price, category, condition, images, area, city,
       distance_km, views, saves, featured, boosted, negotiable, delivery, status, attributes,
       warranty, price_history, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const a of seed.ads) {
      const created = now - a.ageMs;
      insAd.run(
        a.id,
        a.sellerId,
        a.title,
        a.description,
        a.price,
        a.category,
        a.condition,
        JSON.stringify(a.images),
        a.area,
        a.city,
        a.distanceKm,
        a.views,
        a.saves,
        a.featured ? 1 : 0,
        a.boosted ? 1 : 0,
        a.negotiable ? 1 : 0,
        a.delivery ? 1 : 0,
        a.status,
        JSON.stringify(a.attributes ?? {}),
        a.warranty ?? null,
        a.priceHistory
          ? JSON.stringify(a.priceHistory.map((p) => ({ price: p.price, at: now - p.ageMs })))
          : null,
        created,
        created,
      );
    }
    const insReview = db.prepare(`INSERT INTO reviews
      (id, seller_id, author_id, author_name, rating, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const r of seed.reviews) {
      insReview.run(r.id, r.sellerId, r.authorId, r.authorName, r.rating, r.text, now - r.ageMs);
    }
  });
}
