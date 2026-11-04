import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  BadgeCheck,
  BellPlus,
  Camera,
  CornerDownLeft,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Mic,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { AdCard } from '../components/AdCard';
import { TopBar } from '../components/TopBar';
import { EmptyState, Sheet, Toggle } from '../components/ui';
import { MapView } from '../components/MapView';
import { AREAS, CATEGORIES, categoryById, sellerById } from '../lib/data';
import { TRENDING_SEARCHES } from '../lib/seed';
import { toast, useStore } from '../lib/store';
import type { CategoryId, Condition, Filters } from '../lib/types';
import { cn, inr } from '../lib/utils';
import { rankAds } from '../lib/ai';

const SORTS: { id: Filters['sort']; label: string }[] = [
  { id: 'relevance', label: 'Recommended' },
  { id: 'newest', label: 'Newest first' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'distance', label: 'Nearest first' },
];

const CONDITIONS: { id: Condition; label: string }[] = [
  { id: 'new', label: 'Brand new' },
  { id: 'like-new', label: 'Like new' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const ads = useStore((s) => s.ads);
  const area = useStore((s) => s.area);
  const addSavedSearch = useStore((s) => s.addSavedSearch);
  const blocked = useStore((s) => s.blockedSellers);

  const q = params.get('q') ?? '';
  const cat = (params.get('cat') as CategoryId | null) ?? undefined;
  const sort = (params.get('sort') as Filters['sort']) ?? 'relevance';
  const minPrice = params.get('min') ? Number(params.get('min')) : undefined;
  const maxPrice = params.get('max') ? Number(params.get('max')) : undefined;
  const conditions = (params.get('cond')?.split(',').filter(Boolean) as Condition[]) ?? [];
  const maxDistance = params.get('dist') ? Number(params.get('dist')) : undefined;
  const verifiedOnly = params.get('verified') === '1';
  const withPhotos = params.get('photos') === '1';

  const [input, setInput] = useState(q);
  const [sheet, setSheet] = useState<null | 'filter' | 'sort'>(null);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [draft, setDraft] = useState({
    min: minPrice ?? 0,
    max: maxPrice ?? 200000,
    conditions,
    distance: maxDistance ?? 30,
    verifiedOnly,
    withPhotos,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    setDraft({
      min: minPrice ?? 0,
      max: maxPrice ?? 200000,
      conditions,
      distance: maxDistance ?? 30,
      verifiedOnly,
      withPhotos,
    });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === '0') merged.delete(k);
      else merged.set(k, v);
    });
    setParams(merged, { replace: true });
  };

  const activeFilterCount =
    (maxPrice ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (conditions.length ? 1 : 0) +
    (maxDistance ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (withPhotos ? 1 : 0);

  const results = useMemo(() => {
    let list = ads.filter((a) => a.status === 'active' && !blocked.includes(a.sellerId));
    if (cat) list = list.filter((a) => a.category === cat);
    if (q) {
      list = rankAds(list, q, area);
    }
    if (minPrice) list = list.filter((a) => a.price >= minPrice);
    if (maxPrice) list = list.filter((a) => a.price <= maxPrice);
    if (conditions.length) list = list.filter((a) => conditions.includes(a.condition));
    if (maxDistance) list = list.filter((a) => a.distanceKm <= maxDistance);
    if (verifiedOnly)
      list = list.filter((a) => a.sellerId === 'me' || sellerById(a.sellerId).verified);
    if (withPhotos) list = list.filter((a) => a.images.length > 0);

    switch (sort) {
      case 'newest':
        return [...list].sort((a, b) => b.createdAt - a.createdAt);
      case 'price-asc':
        return [...list].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...list].sort((a, b) => b.price - a.price);
      case 'distance':
        return [...list].sort((a, b) => a.distanceKm - b.distanceKm);
      default:
        return [...list].sort(
          (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.saves - a.saves,
        );
    }
  }, [
    ads,
    cat,
    q,
    minPrice,
    maxPrice,
    conditions,
    maxDistance,
    verifiedOnly,
    withPhotos,
    sort,
    area,
    blocked,
  ]);

  const suggestions = useMemo(() => {
    const term = input.trim().toLowerCase();
    if (term.length < 1) return [];
    const cats = CATEGORIES.filter(
      (c) =>
        c.plural.toLowerCase().includes(term) ||
        c.name.toLowerCase().includes(term) ||
        c.keywords.some((k) => k.includes(term)),
    )
      .slice(0, 2)
      .map((c) => ({
        kind: 'cat' as const,
        id: c.id,
        label: c.plural,
        sub: 'Category',
        tint: c.tint,
        emoji: c.emoji,
      }));
    const titles = ads
      .filter((a) => a.status === 'active' && a.title.toLowerCase().includes(term))
      .slice(0, 4)
      .map((a) => ({ kind: 'ad' as const, id: a.id, label: a.title, sub: inr(a.price) }));
    const terms = TRENDING_SEARCHES.filter(
      (t) => t.toLowerCase().includes(term) && t.toLowerCase() !== term,
    )
      .slice(0, 2)
      .map((t) => ({ kind: 'term' as const, id: t, label: t, sub: 'Popular search' }));
    return [...cats, ...titles, ...terms].slice(0, 7);
  }, [input, ads]);

  const applyFilters = () => {
    patch({
      min: draft.min ? String(draft.min) : undefined,
      max: draft.max && draft.max < 200000 ? String(draft.max) : undefined,
      cond: draft.conditions.length ? draft.conditions.join(',') : undefined,
      dist: draft.distance < 30 ? String(draft.distance) : undefined,
      verified: draft.verifiedOnly ? '1' : undefined,
      photos: draft.withPhotos ? '1' : undefined,
    });
    setSheet(null);
  };

  const clearAll = () => {
    setParams(new URLSearchParams(), { replace: true });
    setSaved(false);
  };

  const saveSearch = () => {
    addSavedSearch({
      label: q
        ? `${q}${cat ? ` in ${categoryById(cat)?.plural}` : ''}`
        : `All ${cat ? categoryById(cat)?.plural : 'ads'} in ${area}`,
      query: q,
      category: cat,
      maxPrice: maxPrice,
      minPrice: minPrice,
      alerts: true,
    });
    setSaved(true);
  };

  const startVoice = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult:
          | ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void)
          | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: typeof w.SpeechRecognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      toast('Voice search needs Chrome or Safari on this device', 'info');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript ?? '';
      setInput(transcript);
      patch({ q: transcript });
      toast(`Searching for “${transcript}”`, 'success');
    };
    rec.onerror = () => {
      setListening(false);
      toast('Did not catch that — try again', 'error');
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const catMeta = categoryById(cat);

  return (
    <div className="mx-auto max-w-[1280px]">
      <TopBar
        back
        title={catMeta ? catMeta.plural : 'Browse'}
        subtitle={`${results.length} ads in Kolkata`}
        right={
          <>
            <button
              onClick={() => setView((v) => (v === 'list' ? 'map' : 'list'))}
              aria-label={view === 'list' ? 'Show map view' : 'Show list view'}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-2 text-[12px] font-semibold hairline',
                view === 'map' &&
                  'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
              )}
            >
              {view === 'list' ? <MapIcon size={14} /> : <LayoutGrid size={14} />}
              <span className="hidden xs:inline sm:inline">{view === 'list' ? 'Map' : 'List'}</span>
            </button>
            <button
              onClick={() => setSheet('sort')}
              aria-label="Sort"
              className="grid h-9 w-9 place-items-center rounded-full active:bg-ink-100 dark:active:bg-white/10"
            >
              <ArrowUpDown size={18} />
            </button>
            <button
              onClick={() => setSheet('filter')}
              className={cn(
                'relative flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12.5px] font-semibold hairline',
                activeFilterCount
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : '',
              )}
            >
              <SlidersHorizontal size={14} /> Filters
              {activeFilterCount > 0 && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </>
        }
      />

      {/* Search field + quick chips */}
      <div
        className="sticky top-[57px] z-30 border-b px-4 pb-2 pt-2 backdrop-blur-xl"
        style={{
          background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
          borderColor: 'var(--line)',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            patch({ q: input || undefined });
          }}
          className="relative"
        >
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search in Kolkata"
            className="input py-2.5 pl-10 pr-[74px] text-[14px]"
            autoFocus={false}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {input && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setInput('');
                  patch({ q: undefined });
                }}
                className="grid h-6 w-6 place-items-center rounded-full bg-ink-100 dark:bg-white/10"
              >
                <X size={13} />
              </button>
            )}
            <button
              type="button"
              aria-label="Search by voice"
              onClick={startVoice}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full transition',
                listening
                  ? 'animate-pulse bg-rose-500 text-white'
                  : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
              )}
            >
              <Mic size={15} />
            </button>
          </div>

          {focused && suggestions.length > 0 && (
            <div
              className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border shadow-float animate-fade-in hairline"
              style={{ background: 'var(--surface)' }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {suggestions.map((sg) => (
                <button
                  key={`${sg.kind}-${sg.id}`}
                  onClick={() => {
                    setFocused(false);
                    if (sg.kind === 'ad') navigate(`/ad/${sg.id}`);
                    else if (sg.kind === 'cat') {
                      setInput('');
                      patch({ cat: sg.id as CategoryId, q: undefined });
                    } else {
                      setInput(sg.id);
                      patch({ q: sg.id });
                    }
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-50 dark:hover:bg-white/5"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-100 text-[13px] dark:bg-white/10">
                    {sg.kind === 'cat' ? (
                      sg.emoji
                    ) : sg.kind === 'ad' ? (
                      <Search size={13} />
                    ) : (
                      <Sparkles size={13} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{sg.label}</span>
                    <span className="block truncate text-[10.5px] text-muted">{sg.sub}</span>
                  </span>
                  <CornerDownLeft size={13} className="shrink-0 text-muted" />
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          <button
            onClick={() => patch({ cat: undefined })}
            className={cn('chip', !cat && 'chip-on')}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => patch({ cat: c.id })}
              className={cn('chip', cat === c.id && 'chip-on')}
            >
              <span className="text-[13px]">{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {minPrice ? (
              <FilterPill onClear={() => patch({ min: undefined })}>Min {inr(minPrice)}</FilterPill>
            ) : null}
            {maxPrice ? (
              <FilterPill onClear={() => patch({ max: undefined })}>
                Under {inr(maxPrice)}
              </FilterPill>
            ) : null}
            {conditions.map((c) => (
              <FilterPill
                key={c}
                onClear={() =>
                  patch({ cond: conditions.filter((x) => x !== c).join(',') || undefined })
                }
              >
                {CONDITIONS.find((x) => x.id === c)?.label}
              </FilterPill>
            ))}
            {maxDistance ? (
              <FilterPill onClear={() => patch({ dist: undefined })}>
                Within {maxDistance} km
              </FilterPill>
            ) : null}
            {verifiedOnly ? (
              <FilterPill onClear={() => patch({ verified: undefined })}>Verified</FilterPill>
            ) : null}
            {withPhotos ? (
              <FilterPill onClear={() => patch({ photos: undefined })}>With photos</FilterPill>
            ) : null}
            <button onClick={clearAll} className="px-1.5 text-[12px] font-semibold text-brand-600">
              Clear all
            </button>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12.5px] text-muted">
            <span className="font-bold text-[color:var(--text)]">{results.length}</span> results
            {q && <> for “{q}”</>} · {SORTS.find((s) => s.id === sort)?.label}
          </p>
          <button
            onClick={saveSearch}
            disabled={saved}
            className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-700 disabled:opacity-60 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <BellPlus size={12} /> {saved ? 'Saved' : 'Save search'}
          </button>
        </div>

        {!q && !cat && (
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
              Trending searches
            </p>
            <div className="flex flex-wrap gap-2">
              {TRENDING_SEARCHES.map((t) => (
                <button key={t} onClick={() => patch({ q: t })} className="chip">
                  <Sparkles size={12} className="text-accent-500" /> {t}
                </button>
              ))}
            </div>
            <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-muted">
              Neighbourhoods
            </p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {AREAS.slice(0, 8).map((a) => (
                <button key={a} onClick={() => patch({ q: a })} className="chip">
                  <MapPin size={12} /> {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'map' && results.length > 0 ? (
          <div className="space-y-3">
            <MapView ads={results} userArea={area} />
            <p className="text-center text-[11px] text-muted">
              Tap a price pin to preview · prices shown per listing
            </p>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
              {results.slice(0, 10).map((ad) => (
                <div key={ad.id} className="w-[58%] shrink-0 sm:w-[38%]">
                  <AdCard ad={ad} />
                </div>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={<Search size={26} />}
            title="No ads match your filters"
            body="Try widening the price range or removing a filter — new ads are posted every few minutes."
            action="Clear filters"
            onAction={clearAll}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {results.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}

        {results.length > 8 && (
          <div className="mt-6 rounded-2xl border border-dashed p-5 text-center hairline">
            <p className="text-[13.5px] font-bold">Never miss a deal</p>
            <p className="mx-auto mt-1 max-w-xs text-[12px] text-muted">
              Save this search and we'll ping you the moment a matching ad is posted.
            </p>
            <button onClick={saveSearch} className="btn btn-primary mx-auto mt-3 px-5 py-2.5">
              <BellPlus size={15} /> {saved ? 'Search saved' : 'Save this search'}
            </button>
          </div>
        )}
      </div>

      {/* Sort sheet */}
      <Sheet open={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort results">
        <div className="space-y-1.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                patch({ sort: s.id === 'relevance' ? undefined : s.id });
                setSheet(null);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-medium hairline',
                sort === s.id && 'border-brand-500 bg-brand-50 dark:bg-brand-500/10',
              )}
            >
              {s.label}
              {sort === s.id && <BadgeCheck size={17} className="text-brand-600" />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Filter sheet */}
      <Sheet
        open={sheet === 'filter'}
        onClose={() => setSheet(null)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDraft({
                  min: 0,
                  max: 200000,
                  conditions: [],
                  distance: 30,
                  verifiedOnly: false,
                  withPhotos: false,
                });
                clearAll();
              }}
              className="btn btn-outline flex-1"
            >
              Reset
            </button>
            <button onClick={applyFilters} className="btn btn-primary flex-[2]">
              Show {results.length || ''} results
            </button>
          </div>
        }
      >
        <div className="space-y-5 pb-2">
          <div>
            <p className="label">Price range</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">
                  ₹
                </span>
                <input
                  type="number"
                  value={draft.min || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, min: Number(e.target.value) }))}
                  placeholder="Min"
                  className="input py-2.5 pl-6 text-[13.5px]"
                />
              </div>
              <span className="text-muted">—</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">
                  ₹
                </span>
                <input
                  type="number"
                  value={draft.max >= 200000 ? '' : draft.max}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, max: Number(e.target.value) || 200000 }))
                  }
                  placeholder="Max"
                  className="input py-2.5 pl-6 text-[13.5px]"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[5000, 20000, 50000, 100000, 500000].map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft((d) => ({ ...d, max: p }))}
                  className={cn('chip px-3 py-1.5 text-[12px]', draft.max === p && 'chip-on')}
                >
                  under {inr(p)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Condition</p>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map((c) => {
                const on = draft.conditions.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        conditions: on
                          ? d.conditions.filter((x) => x !== c.id)
                          : [...d.conditions, c.id],
                      }))
                    }
                    className={cn('chip', on && 'chip-on')}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label mb-0">Distance</p>
              <span className="text-[12.5px] font-bold text-brand-600 dark:text-brand-400">
                within {draft.distance} km
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={draft.distance}
              onChange={(e) => setDraft((d) => ({ ...d, distance: Number(e.target.value) }))}
              className="w-full"
            />
          </div>

          <div className="divide-hair rounded-xl border hairline">
            <label className="flex items-center justify-between px-3.5 py-3">
              <span className="flex items-center gap-2 text-[13.5px] font-medium">
                <BadgeCheck size={15} className="text-brand-500" /> Verified sellers only
              </span>
              <Toggle
                checked={draft.verifiedOnly}
                onChange={(v) => setDraft((d) => ({ ...d, verifiedOnly: v }))}
                label="Verified sellers only"
              />
            </label>
            <label className="flex items-center justify-between px-3.5 py-3">
              <span className="flex items-center gap-2 text-[13.5px] font-medium">
                <Camera size={15} className="text-brand-500" /> Only ads with photos
              </span>
              <Toggle
                checked={draft.withPhotos}
                onChange={(v) => setDraft((d) => ({ ...d, withPhotos: v }))}
                label="Only ads with photos"
              />
            </label>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function FilterPill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full bg-ink-900 px-2.5 py-1.5 text-[11.5px] font-semibold text-white dark:bg-white dark:text-ink-900"
    >
      {children}
      <X size={11} strokeWidth={3} />
    </button>
  );
}
