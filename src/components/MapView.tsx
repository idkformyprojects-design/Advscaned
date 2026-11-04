import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Navigation, X } from 'lucide-react';
import { AREA_COORDS, MAP_BOUNDS, adCoords, pinLabel, project } from '../lib/geo';
import type { Ad } from '../lib/types';
import { cn, inr, timeAgo } from '../lib/utils';
import { AdThumb, FavoriteButton } from './AdCard';

const W = 400;
const H = 520;

const ROADS: [number, number][][] = [
  // north–south spine (EM Bypass-ish)
  [
    [22.635, 88.4],
    [22.6, 88.405],
    [22.56, 88.402],
    [22.51, 88.398],
    [22.46, 88.395],
  ],
  // central artery
  [
    [22.62, 88.35],
    [22.58, 88.36],
    [22.545, 88.356],
    [22.51, 88.36],
    [22.47, 88.365],
  ],
  // east–west across the north
  [
    [22.6, 88.29],
    [22.605, 88.35],
    [22.612, 88.42],
    [22.615, 88.48],
  ],
  // south connector
  [
    [22.5, 88.3],
    [22.505, 88.36],
    [22.512, 88.42],
    [22.52, 88.47],
  ],
  // outer ring
  [
    [22.475, 88.44],
    [22.53, 88.455],
    [22.58, 88.44],
    [22.615, 88.45],
  ],
];

const RIVER: [number, number][] = [
  [22.66, 88.3],
  [22.62, 88.308],
  [22.585, 88.316],
  [22.56, 88.326],
  [22.545, 88.334],
  [22.53, 88.338],
  [22.505, 88.33],
  [22.48, 88.32],
  [22.45, 88.305],
  [22.42, 88.29],
];

const PARKS: { lat: number; lng: number; rx: number; ry: number; rotate?: number }[] = [
  { lat: 22.5845, lng: 88.411, rx: 13, ry: 22 }, // Central Park, Salt Lake
  { lat: 22.612, lng: 88.466, rx: 16, ry: 14 }, // Eco Park
  { lat: 22.5545, lng: 88.343, rx: 14, ry: 11, rotate: -12 }, // Maidan
  { lat: 22.517, lng: 88.343, rx: 9, ry: 8 }, // National Library / Alipore
  { lat: 22.497, lng: 88.37, rx: 7, ry: 10 }, // Jadavpur lake area
];

export function MapView({ ads, userArea }: { ads: Ad[]; userArea: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const pins = useMemo(
    () =>
      ads.slice(0, 24).map((ad) => {
        const { lat, lng } = adCoords(ad);
        const { x, y } = project(lat, lng, W, H);
        return { ad, x, y, left: (x / W) * 100, top: (y / H) * 100 };
      }),
    [ads],
  );
  const active = pins.find((p) => p.ad.id === selected) ?? null;
  const center = AREA_COORDS[userArea] ?? AREA_COORDS['Salt Lake'];
  const me = project(center.lat, center.lng, W, H);

  const riverPath = RIVER.map(([lat, lng], i) => {
    const p = project(lat, lng, W, H);
    return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-2xl border hairline"
        style={{ background: 'var(--map-bg)' }}
      >
        <div className="relative aspect-[400/520] w-full sm:aspect-[16/11] sm:max-h-[560px]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--map-tint)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--map-tint)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="var(--map-bg)" />
            <rect width={W} height={H} fill="url(#mapFade)" />

            {/* parks */}
            {PARKS.map((p, i) => {
              const c = project(p.lat, p.lng, W, H);
              return (
                <ellipse
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  rx={p.rx}
                  ry={p.ry}
                  fill="var(--map-park)"
                  transform={p.rotate ? `rotate(${p.rotate} ${c.x} ${c.y})` : undefined}
                />
              );
            })}

            {/* river */}
            <path
              d={riverPath}
              fill="none"
              stroke="var(--map-water)"
              strokeWidth="16"
              strokeLinecap="round"
              opacity="0.55"
            />
            <path
              d={riverPath}
              fill="none"
              stroke="var(--map-water)"
              strokeWidth="9"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* roads */}
            {ROADS.map((road, i) => {
              const d = road
                .map(([lat, lng], j) => {
                  const p = project(lat, lng, W, H);
                  return `${j === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                })
                .join(' ');
              return (
                <g key={i}>
                  <path
                    d={d}
                    fill="none"
                    stroke="var(--map-road)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    opacity="0.65"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="var(--map-road-line)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                </g>
              );
            })}

            {/* area labels */}
            {Object.entries(AREA_COORDS).map(([name, c]) => {
              const p = project(c.lat, c.lng, W, H);
              return (
                <text
                  key={name}
                  x={p.x}
                  y={p.y - 16}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="600"
                  fill="var(--map-label)"
                  opacity="0.8"
                  style={{ letterSpacing: '0.04em' }}
                >
                  {name.toUpperCase()}
                </text>
              );
            })}

            {/* user location */}
            <circle cx={me.x} cy={me.y} r="18" fill="var(--brand)" opacity="0.14" />
            <circle cx={me.x} cy={me.y} r="5" fill="var(--brand)" stroke="#fff" strokeWidth="2" />
          </svg>

          {/* pins */}
          {pins.map(({ ad, left, top }) => {
            const isActive = ad.id === selected;
            return (
              <button
                key={ad.id}
                onClick={() => setSelected(isActive ? null : ad.id)}
                aria-label={`${ad.title} on map`}
                className={cn(
                  'absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border px-2 py-1 text-[10.5px] font-bold shadow-md transition-all active:scale-95',
                  isActive
                    ? 'scale-110 border-ink-900 bg-ink-900 text-white dark:border-white dark:bg-white dark:text-ink-900'
                    : 'border-white/70 bg-white text-ink-800 hover:scale-105 dark:border-white/20 dark:bg-ink-800 dark:text-white',
                )}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                {pinLabel(ad.price, ad.category)}
                <span
                  className={cn(
                    'absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r',
                    isActive
                      ? 'border-ink-900 bg-ink-900 dark:border-white dark:bg-white'
                      : 'border-white/70 bg-white dark:border-white/20 dark:bg-ink-800',
                  )}
                />
              </button>
            );
          })}

          {/* legend */}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-ink-800 shadow-sm backdrop-blur dark:bg-ink-900/85 dark:text-white">
              <MapPin size={10} className="text-brand-600 dark:text-brand-400" />
              {pins.length} ads
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-ink-600 shadow-sm backdrop-blur dark:bg-ink-900/85 dark:text-ink-200">
              <Navigation size={9} /> {userArea}
            </span>
          </div>

          {/* selected preview */}
          {active && (
            <div className="absolute inset-x-2.5 bottom-2.5 z-20 animate-slide-up">
              <div className="flex items-center gap-2.5 rounded-xl border bg-[color:var(--surface)] p-2 shadow-float hairline">
                <Link
                  to={`/ad/${active.ad.id}`}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/5"
                >
                  <AdThumb ad={active.ad} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold">{inr(active.ad.price)}</p>
                  <p className="truncate text-[11.5px] font-medium">{active.ad.title}</p>
                  <p className="text-[10.5px] text-muted">
                    {active.ad.area} · {active.ad.distanceKm} km · {timeAgo(active.ad.createdAt)}
                  </p>
                </div>
                <FavoriteButton adId={active.ad.id} />
                <Link
                  to={`/ad/${active.ad.id}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white"
                  aria-label="Open ad"
                >
                  <ArrowRight size={16} />
                </Link>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close preview"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
