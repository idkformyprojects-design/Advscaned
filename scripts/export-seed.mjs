/**
 * Exports the app's demo sellers, listings and reviews into server/seed.json so a fresh
 * backend database starts with the same marketplace the offline demo shows.
 * Timestamps are stored as ages ("ageMs") so seeded ads always look recent.
 * Run: node scripts/export-seed.mjs   (Node 22.18+ — it imports the TypeScript sources directly)
 */
import { writeFileSync } from 'node:fs';

const { SEED_ADS, SEED_REVIEWS } = await import('../src/lib/seed.ts');
const { SELLERS } = await import('../src/lib/data.ts');

const now = Date.now();
const age = (ts) => Math.max(0, now - ts);

const seed = {
  sellers: SELLERS,
  ads: SEED_ADS.map(({ createdAt, priceHistory, ...ad }) => ({
    ...ad,
    ageMs: age(createdAt),
    priceHistory: priceHistory?.map((p) => ({ price: p.price, ageMs: age(p.at) })),
  })),
  reviews: SEED_REVIEWS.map(({ createdAt, ...r }) => ({ ...r, ageMs: age(createdAt) })),
};

writeFileSync(new URL('../server/seed.json', import.meta.url), JSON.stringify(seed, null, 2) + '\n');
console.log(
  `server/seed.json: ${seed.sellers.length} sellers, ${seed.ads.length} ads, ${seed.reviews.length} reviews`,
);
