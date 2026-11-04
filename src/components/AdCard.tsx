import { Heart, MapPin, BadgeCheck, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryById } from '../lib/data';
import { useAdDistance, useSeller } from '../lib/hooks';
import { useStore } from '../lib/store';
import type { Ad } from '../lib/types';
import { cn, inr, priceLabel, timeAgo, vibrate } from '../lib/utils';
import { Avatar } from './ui';

export function SafeImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function AdThumb({ ad, className }: { ad: Ad; className?: string }) {
  const cat = categoryById(ad.category);
  const bg = {
    background: `linear-gradient(140deg, ${cat?.tint}26, ${cat?.tint}08 65%), var(--surface-2)`,
  };
  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)} style={bg}>
      <span className="absolute inset-0 grid place-items-center text-4xl opacity-45">
        {cat?.emoji}
      </span>
      {ad.images[0] && (
        <SafeImage
          src={ad.images[0]}
          alt={ad.title}
          className="relative h-full w-full object-cover"
        />
      )}
      {!ad.images.length && (
        <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted">
          {cat?.name}
        </span>
      )}
    </div>
  );
}

export function FavoriteButton({
  adId,
  size = 'sm',
  className,
}: {
  adId: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const favorites = useStore((s) => s.favorites);
  const toggle = useStore((s) => s.toggleFavorite);
  const on = favorites.includes(adId);
  return (
    <button
      aria-label={on ? 'Remove from favourites' : 'Save ad'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        vibrate(10);
        toggle(adId);
      }}
      className={cn(
        'grid place-items-center rounded-full bg-white/90 text-ink-700 shadow-sm backdrop-blur transition active:scale-90 dark:bg-ink-900/80 dark:text-white',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        className,
      )}
    >
      <Heart
        size={size === 'sm' ? 16 : 19}
        className={cn(on && 'fill-rose-500 text-rose-500')}
        strokeWidth={2.2}
      />
    </button>
  );
}

export function priceDrop(ad: Ad): { from: number; pct: number } | null {
  const history = ad.priceHistory;
  if (!history || history.length < 2) return null;
  const from = history[0].price;
  if (from <= ad.price) return null;
  return { from, pct: Math.round(((from - ad.price) / from) * 100) };
}

export function AdCard({ ad, compact = false }: { ad: Ad; compact?: boolean }) {
  const seller = useSeller(ad.sellerId);
  const distance = useAdDistance();
  const drop = priceDrop(ad);
  return (
    <Link
      to={`/ad/${ad.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border shadow-card transition-transform duration-200 will-change-transform hover:-translate-y-0.5"
      style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-ink-100 dark:bg-white/5',
          compact ? 'aspect-[4/3]' : 'aspect-[5/4]',
        )}
      >
        <AdThumb ad={ad} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
          <div className="flex flex-col gap-1">
            {ad.featured && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent-500 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-900 shadow">
                <Sparkles size={10} /> Featured
              </span>
            )}
            {ad.boosted && !ad.featured && (
              <span className="inline-flex items-center gap-1 rounded-md bg-ink-900/90 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                <Zap size={10} /> Boosted
              </span>
            )}
          </div>
          <FavoriteButton adId={ad.id} />
        </div>
        {ad.images.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-ink-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            1/{ad.images.length}
          </span>
        )}
        {ad.status === 'sold' && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/55">
            <span className="-rotate-6 rounded-md border-2 border-white px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
              Sold
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[17px] font-extrabold tracking-tight">{priceLabel(ad)}</span>
          {drop ? (
            <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              ↓{drop.pct}%
            </span>
          ) : (
            ad.negotiable &&
            ad.category !== 'jobs' && (
              <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                Negotiable
              </span>
            )
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 min-h-[34px] text-[13px] font-medium leading-[1.35] text-ink-700 dark:text-ink-100">
          {ad.title}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 pt-1">
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">
              {ad.area} · {distance(ad)} km
            </span>
          </span>
          <span className="shrink-0 text-[11px] text-muted">{timeAgo(ad.createdAt)}</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 border-t pt-2 hairline">
          <Avatar name={seller.name} color={seller.avatarColor} size={18} />
          <span className="truncate text-[11px] font-medium text-muted">{seller.name}</span>
          {seller.verified && <BadgeCheck size={13} className="shrink-0 text-brand-500" />}
          <span className="ml-auto shrink-0 text-[11px] text-muted">
            {ad.views.toLocaleString('en-IN')} views
          </span>
        </div>
      </div>
    </Link>
  );
}

export function AdRow({ ad, right }: { ad: Ad; right?: React.ReactNode }) {
  return (
    <Link
      to={`/ad/${ad.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50/60 dark:hover:bg-white/5"
    >
      <div className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-ink-100 dark:bg-white/5">
        <AdThumb ad={ad} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-tight">{inr(ad.price)}</p>
        <p className="mt-0.5 truncate text-[13px] text-ink-600 dark:text-ink-200">{ad.title}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
          <MapPin size={10} /> {ad.area} · {timeAgo(ad.createdAt)}
        </p>
      </div>
      {right}
    </Link>
  );
}
