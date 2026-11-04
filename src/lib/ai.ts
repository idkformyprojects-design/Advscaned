import { CATEGORIES, categoryById } from './data';
import type { Ad, CategoryId } from './types';

/**
 * On-device "assist" engine.
 * Everything here runs locally with heuristics so the app needs no API key —
 * swap `suggestPrice` / `writeDescription` for a real model endpoint later.
 */

const KEYWORDS: Record<string, { cat: CategoryId; weight: number }[]> = {};
CATEGORIES.forEach((c) => {
  c.keywords.forEach((k) => {
    KEYWORDS[k] = [...(KEYWORDS[k] ?? []), { cat: c.id, weight: 1 }];
  });
});

export function detectCategory(title: string, description = ''): CategoryId | null {
  const text = `${title} ${description}`.toLowerCase();
  let best: { cat: CategoryId; score: number } | null = null;
  (Object.keys(KEYWORDS) as string[]).forEach((k) => {
    if (!text.includes(k)) return;
    KEYWORDS[k].forEach(({ cat }) => {
      const score = (best?.cat === cat ? 2 : 1) + k.length / 20;
      if (!best || best.cat === cat || score > best.score) best = { cat, score };
    });
  });
  return best ? (best as { cat: CategoryId }).cat : null;
}

const CONDITION_MULTIPLIER = { new: 0.92, 'like-new': 0.78, good: 0.66, fair: 0.5 } as const;

/** Comparable-based price estimate from live listings in the same category. */
export function suggestPrice(input: {
  title: string;
  category: CategoryId;
  condition: keyof typeof CONDITION_MULTIPLIER;
  ads: Ad[];
}): { low: number; mid: number; high: number; comparables: Ad[]; confidence: number } {
  const comparables = input.ads
    .filter((a) => a.category === input.category && a.status !== 'draft')
    .slice(0, 40);
  if (!comparables.length) {
    return { low: 0, mid: 0, high: 0, comparables: [], confidence: 0 };
  }
  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  };
  const base = median(comparables.map((a) => a.price));
  const tokens = input.title
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);
  const matchBonus = comparables.filter((a) =>
    tokens.some((t) => a.title.toLowerCase().includes(t)),
  );
  const anchor = matchBonus.length ? median(matchBonus.map((a) => a.price)) : base;
  const mid = Math.round((anchor * CONDITION_MULTIPLIER[input.condition]) / 500) * 500;
  return {
    low: Math.round((mid * 0.85) / 500) * 500,
    mid,
    high: Math.round((mid * 1.18) / 500) * 500,
    comparables: comparables.slice(0, 4),
    confidence: Math.min(94, 52 + matchBonus.length * 7 + comparables.length * 2),
  };
}

const HOOKS = [
  'Well maintained and ready for a new home',
  'Genuine listing, no dealers involved',
  'Upgrading, so priced to sell quickly',
  'Everything works exactly as it should',
];

export function writeDescription(input: {
  category: CategoryId;
  title: string;
  condition: string;
  area: string;
  price: number;
  attributes: Record<string, string>;
}): string {
  const meta = categoryById(input.category);
  const attrLine = Object.entries(input.attributes)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const label = meta?.fields.find((f) => f.key === k)?.label ?? k;
      return `${label}: ${v}`;
    })
    .join(' · ');
  const hook = HOOKS[Math.floor(Math.random() * HOOKS.length)];
  const lines = [
    `${input.title || meta?.name || 'Item'} in ${input.condition} condition. ${hook}.`,
    attrLine ? `${attrLine}.` : '',
    `Located in ${input.area}, Kolkata. Inspection and test before payment welcome — I would rather you were fully confident.`,
    `Price is fair for the condition; small negotiation possible for a serious buyer who can collect this week.`,
  ].filter(Boolean);
  return lines.join('\n\n');
}

export function suggestTitles(category: CategoryId, attributes: Record<string, string>): string[] {
  const meta = categoryById(category);
  if (!meta) return [];
  const brand = attributes.brand ?? '';
  const year = attributes.year ?? '';
  const model = attributes.model ?? '';
  const storage = attributes.storage ?? '';
  const bhk = attributes.bhk ?? '';
  const base = [brand, model || meta.name, year, storage, bhk]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const out = new Set<string>();
  if (base) out.add(base);
  out.add(
    `${meta.name} · ${attributes.fuel ? attributes.fuel + ' · ' : ''}${attributes.km ? attributes.km + ' km · ' : ''}Excellent condition`,
  );
  out.add(`${meta.name} for sale · ${attributes.owners ?? attributes.furnishing ?? 'Well kept'}`);
  return Array.from(out).slice(0, 3);
}

/** Relevance ranking: match quality + freshness + location + quality signals. */
export function rankAds<T extends Ad>(ads: T[], query: string, userArea: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...ads].sort((a, b) => {
      const score = (ad: Ad) => (ad.featured ? 12 : 0) + (ad.boosted ? 8 : 0) + ad.saves / 20;
      return score(b) - score(a);
    });
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  return [...ads]
    .map((ad) => {
      const hay =
        `${ad.title} ${ad.description} ${ad.attributes ? Object.values(ad.attributes).join(' ') : ''}`.toLowerCase();
      let score = 0;
      tokens.forEach((t) => {
        if (ad.title.toLowerCase().includes(t)) score += 12;
        else if (hay.includes(t)) score += 5;
        if (ad.area.toLowerCase().includes(t)) score += 3;
      });
      if (ad.featured) score += 3;
      if (ad.area === userArea) score += 2;
      score += Math.min(4, ad.saves / 40);
      score -= ad.distanceKm / 25;
      return { ad, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.ad);
}

export function quickReplies(adTitle: string): string[] {
  return [
    'Is this still available?',
    'What is your best price?',
    `Can I see ${adTitle.split(' ').slice(0, 2).join(' ')} today?`,
    'Would you accept a bank transfer?',
  ];
}
