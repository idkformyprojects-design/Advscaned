/**
 * Seeds an empty Firestore with the demo marketplace (5 sellers, 16 listings, 6 reviews)
 * and the public config document. Safe to run repeatedly: does nothing if ads exist.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=key.json GCLOUD_PROJECT=<project> node scripts/seed.mjs
 *   (or against the emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-bazaar …)
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export async function seed(db, { force = false, now = Date.now() } = {}) {
  const existing = await db.collection('ads').limit(1).get();
  if (!existing.empty && !force) return { seeded: false };
  const data = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
  const batch = db.batch();
  for (const s of data.sellers) {
    batch.set(db.doc(`users/${s.id}`), {
      name: s.name,
      area: 'Salt Lake',
      avatarColor: s.avatarColor,
      photoURL: null,
      bio: s.bio ?? null,
      verified: s.verified,
      rating: s.rating,
      reviewsCount: s.reviews,
      responseRate: s.responseRate,
      responseTime: s.responseTime,
      role: 'user',
      banned: false,
      isDemo: true,
      createdAt: Date.UTC(Number(s.joined) || 2022, 0, 15),
    });
  }
  for (const { ageMs, priceHistory, id, ...ad } of data.ads) {
    batch.set(db.doc(`ads/${id}`), {
      ...ad,
      createdAt: now - ageMs,
      boostedUntil: ad.boosted ? now + 7 * 86_400_000 : null,
      ...(priceHistory
        ? { priceHistory: priceHistory.map((p) => ({ price: p.price, at: now - p.ageMs })) }
        : {}),
    });
  }
  for (const { ageMs, id, ...r } of data.reviews) {
    batch.set(db.doc(`reviews/${id}`), { ...r, createdAt: now - ageMs });
  }
  batch.set(
    db.doc('config/public'),
    { payments: false, boostPricePaise: 14_900, boostDays: 7 },
    { merge: true },
  );
  await batch.commit();
  return { seeded: true, ads: data.ads.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  const res = await seed(getFirestore(), { force: process.argv.includes('--force') });
  console.log(
    res.seeded ? `Seeded ${res.ads} demo ads.` : 'Database already has ads — nothing seeded.',
  );
}
