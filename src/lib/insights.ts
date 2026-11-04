import type { Ad, Chat } from './types';

/** Stable 32-bit hash so demo analytics never change between renders. */
export const hash = (input: string) => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const seeded = (seed: number, i: number) => {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Splits an ad's lifetime views into a daily series.
 * Weighted so recent days trend upward, with a bump for promoted ads.
 */
export function viewSeries(ad: Ad, days = 7): number[] {
  const seed = hash(ad.id);
  const weights = Array.from({ length: days }, (_, i) => {
    const growth = 0.75 + (i / Math.max(1, days - 1)) * 0.6;
    const noise = 0.7 + seeded(seed, i) * 0.8;
    return growth * noise * (ad.featured ? 1.35 : ad.boosted ? 1.2 : 1);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  // Only a slice of lifetime views lands in the selected window.
  const windowViews = Math.round(ad.views * (days <= 7 ? 0.42 : 0.86));
  const series = weights.map((w) => Math.max(1, Math.round((windowViews * w) / total)));
  // Rounding drift fix on the busiest day.
  const diff = windowViews - series.reduce((a, b) => a + b, 0);
  const maxIdx = series.indexOf(Math.max(...series));
  series[maxIdx] = Math.max(1, series[maxIdx] + diff);
  return series;
}

export const seriesTotal = (series: number[]) => series.reduce((a, b) => a + b, 0);

/** Percentage change of the newest half vs the oldest half of the window. */
export function trend(series: number[]): number {
  if (series.length < 4) return 0;
  const half = Math.floor(series.length / 2);
  const first = series.slice(0, half).reduce((a, b) => a + b, 0) || 1;
  const last = series.slice(-half).reduce((a, b) => a + b, 0);
  return Math.round(((last - first) / first) * 100);
}

export function sparkPath(values: number[], width: number, height: number, pad = 2) {
  if (!values.length) return { line: '', area: '' };
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const stepX = (width - pad * 2) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => {
      if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const [px, py] = pts[i - 1];
      const cx = (px + x) / 2;
      return `C ${cx.toFixed(1)} ${py.toFixed(1)}, ${cx.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `${line} L ${(pad + (values.length - 1) * stepX).toFixed(1)} ${height - pad} L ${pad} ${height - pad} Z`;
  return { line, area };
}

export function chatsForAd(adId: string, chats: Chat[]): number {
  return chats.filter((c) => c.adId === adId).length;
}

export interface SellerOverview {
  views: number;
  uniqueViewers: number;
  saves: number;
  chats: number;
  live: number;
  sold: number;
  series: number[];
  trendPct: number;
  conversion: number;
  replyQuality: number;
}

export function sellerOverview(ads: Ad[], chats: Chat[], days = 7): SellerOverview {
  const mine = ads.filter((a) => a.sellerId === 'me');
  const series = mine.reduce<number[]>(
    (acc, ad) => {
      const s = viewSeries(ad, days);
      return acc.map((v, i) => v + (s[i] ?? 0));
    },
    Array.from({ length: days }, () => 0),
  );
  const views = minesSum(mine.map((a) => a.views));
  const saves = minesSum(mine.map((a) => a.saves));
  const chatsCount = mine.reduce((n, ad) => n + chatsForAd(ad.id, chats), 0);
  const windowViews = seriesTotal(series);
  return {
    views,
    uniqueViewers: Math.round(views * 0.68),
    saves,
    chats: chatsCount,
    live: mine.filter((a) => a.status === 'active').length,
    sold: mine.filter((a) => a.status === 'sold').length,
    series,
    trendPct: trend(series),
    conversion: windowViews ? Math.round((saves / windowViews) * 1000) / 10 : 0,
    replyQuality: chatsCount ? Math.min(100, 60 + chatsCount * 6) : 0,
  };
}

const minesSum = (nums: number[]) => nums.reduce((a, b) => a + b, 0);

/** What a seller should do next, ranked by expected impact. */
export function sellerTips(
  ads: Ad[],
  chats: Chat[],
): { title: string; body: string; to?: string }[] {
  const mine = ads.filter((a) => a.sellerId === 'me' && a.status === 'active');
  const tips: { title: string; body: string; to?: string }[] = [];

  const noPhotos = mine.filter((a) => a.images.length === 0);
  if (noPhotos.length) {
    tips.push({
      title: `Add photos to ${noPhotos.length} ad${noPhotos.length > 1 ? 's' : ''}`,
      body: 'Listings with photos get up to 7× more views. It takes 30 seconds.',
      to: '/myads',
    });
  }

  const stale = mine
    .filter((a) => Date.now() - a.createdAt > 5 * 86400000 && !a.boosted)
    .sort((a, b) => b.views - a.views)[0];
  if (stale) {
    tips.push({
      title: 'Refresh a stale listing',
      body: `“${stale.title.slice(0, 32)}…” is 5+ days old — boosting puts it back on top.`,
      to: '/myads',
    });
  }

  const chatty = [...mine].sort((a, b) => chatsForAd(b.id, chats) - chatsForAd(a.id, chats))[0];
  if (chatty && chatsForAd(chatty.id, chats) > 0) {
    tips.push({
      title: 'Reply fast to convert buyers',
      body: `You have ${chatsForAd(chatty.id, chats)} conversation${chatsForAd(chatty.id, chats) > 1 ? 's' : ''} on “${chatty.title.slice(0, 26)}…”. Sellers replying within 5 minutes sell 2× faster.`,
      to: '/chats',
    });
  }

  if (!tips.length) {
    tips.push({
      title: 'Post your first ad',
      body: 'Your insights fill up as soon as buyers start viewing your listings.',
      to: '/post',
    });
  }
  return tips.slice(0, 3);
}
