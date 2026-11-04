import { Link, useNavigate } from 'react-router-dom';
import { Bell, BellOff, Search, Trash2, TrendingUp } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { EmptyState, Toggle } from '../components/ui';
import { toast, useStore } from '../lib/store';
import { categoryById } from '../lib/data';
import { inr, timeAgo } from '../lib/utils';

export default function SavedSearchesPage() {
  const searches = useStore((s) => s.savedSearches);
  const remove = useStore((s) => s.removeSavedSearch);
  const toggleAlerts = useStore((s) => s.toggleSearchAlerts);
  const ads = useStore((s) => s.ads);
  const navigate = useNavigate();

  const matchCount = (q: string, cat?: string, max?: number) =>
    ads.filter(
      (a) =>
        a.status === 'active' &&
        (!q || `${a.title} ${a.description}`.toLowerCase().includes(q.toLowerCase())) &&
        (!cat || a.category === cat) &&
        (!max || a.price <= max),
    ).length;

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar back="/profile" title="Saved searches" subtitle="Get pinged when new ads match" />

      {searches.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No saved searches"
          body="Search for something, then tap “Save search” to get alerts for new matches."
          action="Start searching"
          onAction={() => navigate('/search')}
        />
      ) : (
        <div className="space-y-2.5 px-4 py-4">
          {searches.map((s) => {
            const count = matchCount(s.query, s.category, s.maxPrice);
            return (
              <div key={s.id} className="card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/search?q=${encodeURIComponent(s.query)}${s.category ? `&cat=${s.category}` : ''}${s.maxPrice ? `&max=${s.maxPrice}` : ''}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-[14px] font-bold">{s.label}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                      {s.category && <span>{categoryById(s.category)?.plural}</span>}
                      {s.maxPrice && <span>under {inr(s.maxPrice)}</span>}
                      <span>· saved {timeAgo(s.createdAt)}</span>
                    </p>
                  </Link>
                  <button
                    onClick={() => {
                      remove(s.id);
                      toast('Saved search removed', 'info');
                    }}
                    aria-label="Remove"
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t pt-2.5 hairline">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 dark:text-brand-300">
                    <TrendingUp size={13} /> {count} live match{count === 1 ? '' : 'es'}
                  </span>
                  <label className="flex items-center gap-2 text-[11.5px] text-muted">
                    {s.alerts ? <Bell size={12} /> : <BellOff size={12} />} Alerts
                    <Toggle
                      checked={s.alerts}
                      onChange={() => toggleAlerts(s.id)}
                      label={`Alerts for ${s.label}`}
                    />
                  </label>
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-center text-[11px] text-muted">
            Alerts are delivered as in-app notifications in this demo.
          </p>
        </div>
      )}
    </div>
  );
}
