import clsx, { type ClassValue } from 'clsx';

export const cn = (...args: ClassValue[]) => clsx(args);

export const inr = (n: number) => {
  if (!Number.isFinite(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

/** Compact Indian formatting: ₹7.85 L, ₹1.2 Cr */
export const inrShort = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return inr(n);
};

export const priceLabel = (ad: {
  price: number;
  category: string;
  attributes?: Record<string, string>;
}) => {
  if (ad.category === 'jobs') return `${inrShort(ad.price)} / yr`;
  if (ad.category === 'properties') {
    const rent = (ad.attributes?.listingType ?? '').toLowerCase().includes('rent');
    return rent ? `${inr(ad.price)}/mo` : inr(ad.price);
  }
  if (ad.category === 'services') return `from ${inr(ad.price)}`;
  return inr(ad.price);
};

export const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const clockTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export const dayLabel = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return clockTime(ts);
  if (same(d, yest)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

export const uid = (prefix = 'id') =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

/** Resize + compress an uploaded image before it lands in local storage. */
export const compressImage = (file: File, maxSize = 1280, quality = 0.72): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

export const vibrate = (ms = 8) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* noop */
  }
};

export const shareOrCopy = async (data: { title: string; text: string; url: string }) => {
  try {
    if (navigator.share) {
      await navigator.share(data);
      return 'shared';
    }
    await navigator.clipboard.writeText(data.url);
    return 'copied';
  } catch {
    return 'failed';
  }
};

export const scrollTop = (behavior: ScrollBehavior = 'smooth') => {
  const el = document.getElementById('app-scroll');
  if (el) el.scrollTo({ top: 0, behavior });
  else window.scrollTo({ top: 0, behavior });
};
