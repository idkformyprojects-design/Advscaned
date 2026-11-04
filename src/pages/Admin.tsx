import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  Flag,
  IndianRupee,
  Inbox,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AdThumb } from '../components/AdCard';
import { Avatar, Badge, EmptyState, Sheet, Spinner } from '../components/ui';
import { ApiError, type AdminReport, type AdminStats, type ResolveAction } from '../lib/api';
import { adminApi, backend, backendEnabled } from '../lib/backend';
import { toast, useStore } from '../lib/store';
import { cn, inr, timeAgo } from '../lib/utils';

/** Readable message from an API error or a Firebase callable error. */
const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError
    ? e.message
    : e instanceof Error && e.message && !/^internal$/i.test(e.message)
      ? e.message
      : fallback;

const ACTION_COPY: Record<ResolveAction, { title: string; body: string; cta: string }> = {
  dismiss: {
    title: 'Dismiss this report?',
    body: 'Nothing changes for the seller. If the ad was hidden only because of reports, it goes live again.',
    cta: 'Dismiss',
  },
  restore: {
    title: 'Restore this ad?',
    body: 'The ad goes live again, every open report on it is closed and the seller is told it passed review.',
    cta: 'Restore ad',
  },
  remove: {
    title: 'Remove this ad?',
    body: 'The ad is taken down for good. The seller is notified and cannot relist it.',
    cta: 'Remove ad',
  },
  ban: {
    title: 'Ban this seller?',
    body: 'They are signed out everywhere, cannot sign back in, and all their ads are removed. You can unban later.',
    cta: 'Ban seller',
  },
};

export default function Admin() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ report: AdminReport; action: ResolveAction } | null>(
    null,
  );

  const isAdmin = backendEnabled && user?.role === 'admin';

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setError('');
    try {
      const [s, r] = await Promise.all([adminApi.stats(), adminApi.reports(tab)]);
      setStats(s);
      setReports(r.reports);
    } catch (e) {
      setError(errorText(e, 'Could not load reports'));
    }
  }, [isAdmin, tab]);

  useEffect(() => {
    setReports(null);
    void load();
  }, [load]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg">
        <TopBar back="/profile" title="Moderation" />
        <EmptyState
          icon={<ShieldCheck size={26} />}
          title="Moderators only"
          body={
            backend === 'firebase'
              ? 'Your account does not have moderator access. Ask the owner to add your Google email to ADMIN_EMAILS.'
              : backendEnabled
                ? 'Your account does not have moderator access. Ask the server owner to add your number to ADMIN_PHONES.'
                : 'Moderation needs a live backend (Firebase or the Bazaar server).'
          }
          action="Back to account"
          onAction={() => navigate('/profile')}
        />
      </div>
    );
  }

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await adminApi.resolve(pending.report.id, pending.action);
      toast(
        {
          dismiss: 'Report dismissed',
          restore: 'Ad restored',
          remove: 'Ad removed',
          ban: 'Seller banned',
        }[pending.action],
        'success',
      );
      setPending(null);
      await load();
    } catch (e) {
      toast(errorText(e, 'Action failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const unban = async (sellerId: string) => {
    try {
      await adminApi.unban(sellerId);
      toast('Seller unbanned', 'info');
      await load();
    } catch (e) {
      toast(errorText(e, 'Action failed'), 'error');
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar
        back="/profile"
        title="Moderation"
        subtitle={
          stats ? `${stats.openReports} open report${stats.openReports === 1 ? '' : 's'}` : ' '
        }
        right={
          <button
            onClick={() => void load()}
            aria-label="Refresh"
            className="grid h-9 w-9 place-items-center rounded-full active:bg-ink-100 dark:active:bg-white/10"
          >
            <RefreshCw size={17} />
          </button>
        }
      />

      <div className="px-4 pt-4">
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Flag, label: 'Open reports', value: stats.openReports },
              { icon: ShieldCheck, label: 'Under review', value: stats.underReview },
              { icon: Inbox, label: 'Live ads', value: stats.liveAds },
              { icon: Users, label: 'Members', value: stats.users },
              { icon: Ban, label: 'Banned', value: stats.banned },
              { icon: IndianRupee, label: 'Boost revenue', value: inr(stats.revenuePaise / 100) },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-xl border p-3 hairline"
                style={{ background: 'var(--surface)' }}
              >
                <Icon size={14} className="text-brand-600 dark:text-brand-400" />
                <p className="mt-1.5 text-[17px] font-extrabold leading-none">{value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {(['open', 'resolved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('chip', tab === t && 'chip-on')}
            >
              {t === 'open' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-[12.5px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}

        {!reports && !error ? (
          <div className="grid place-items-center py-16 text-muted">
            <Spinner />
          </div>
        ) : reports && reports.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={26} />}
            title={tab === 'open' ? 'All clear' : 'Nothing resolved yet'}
            body={
              tab === 'open'
                ? 'No open reports. New ones appear here as soon as buyers flag something.'
                : 'Reports you act on will be listed here.'
            }
          />
        ) : (
          <div className="mt-3 space-y-2.5 pb-6">
            {reports?.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onAction={(action) => setPending({ report: r, action })}
                onUnban={unban}
              />
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? ACTION_COPY[pending.action].title : ''}
      >
        {pending && (
          <>
            <p className="text-[13px] leading-relaxed text-muted">
              {ACTION_COPY[pending.action].body}
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setPending(null)} className="btn btn-outline flex-1">
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={() => void run()}
                className={cn(
                  'btn flex-1',
                  pending.action === 'remove' || pending.action === 'ban'
                    ? 'bg-rose-600 text-white'
                    : 'btn-primary',
                )}
              >
                {busy ? 'Working…' : ACTION_COPY[pending.action].cta}
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function ReportCard({
  report: r,
  onAction,
  onUnban,
}: {
  report: AdminReport;
  onAction: (a: ResolveAction) => void;
  onUnban: (sellerId: string) => void;
}) {
  const ad = r.target.ad;
  const seller = r.target.seller;
  const open = r.status === 'open';

  return (
    <div className="rounded-2xl border p-3 hairline" style={{ background: 'var(--surface)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-bold">
            <Flag size={13} className="shrink-0 text-rose-500" /> {r.reason}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            by {r.reporterName} · {timeAgo(r.createdAt)}
            {open && r.openReportsOnTarget > 1 && (
              <span className="ml-1 font-bold text-rose-600 dark:text-rose-300">
                · {r.openReportsOnTarget} people reported this
              </span>
            )}
          </p>
        </div>
        {!open && (
          <Badge
            tone={r.resolution === 'dismissed' || r.resolution === 'restored' ? 'neutral' : 'red'}
          >
            {r.resolution}
          </Badge>
        )}
      </div>

      {r.target.missing ? (
        <p className="mt-2.5 rounded-lg bg-ink-50 px-3 py-2 text-[11.5px] text-muted dark:bg-white/5">
          The reported {r.targetType === 'ad' ? 'ad' : 'account'} no longer exists.
        </p>
      ) : ad ? (
        <Link
          to={`/ad/${ad.id}`}
          className="mt-2.5 flex items-center gap-2.5 rounded-xl border p-2 hairline"
        >
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/5">
            <AdThumb ad={ad} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold">{ad.title}</p>
            <p className="text-[11px] text-muted">
              {inr(ad.price)} · {seller?.name ?? 'Unknown seller'}
              {seller?.banned && ' · banned'}
            </p>
          </div>
          <Badge
            tone={ad.status === 'active' ? 'brand' : ad.status === 'pending' ? 'amber' : 'red'}
          >
            {ad.status === 'pending' ? 'hidden' : ad.status}
          </Badge>
        </Link>
      ) : seller ? (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border p-2 hairline">
          <Avatar name={seller.name} color={seller.avatarColor} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold">{seller.name}</p>
            <p className="text-[11px] text-muted">
              {seller.phone} · member since {seller.joined}
            </p>
          </div>
          {seller.banned && <Badge tone="red">banned</Badge>}
        </div>
      ) : null}

      {open && !r.target.missing && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t pt-2.5 hairline">
          <ActionButton icon={CheckCircle2} label="Dismiss" onClick={() => onAction('dismiss')} />
          {ad?.status === 'pending' && (
            <ActionButton icon={RotateCcw} label="Restore" onClick={() => onAction('restore')} />
          )}
          {ad && ad.status !== 'removed' && (
            <ActionButton
              icon={Trash2}
              label="Remove ad"
              danger
              onClick={() => onAction('remove')}
            />
          )}
          {seller && !seller.banned && (
            <ActionButton icon={Ban} label="Ban seller" danger onClick={() => onAction('ban')} />
          )}
        </div>
      )}
      {seller?.banned && (
        <button
          onClick={() => onUnban(seller.id)}
          className="mt-2 flex items-center gap-1 text-[11.5px] font-bold text-brand-600 dark:text-brand-400"
        >
          <UserCheck size={13} /> Unban {seller.name.split(' ')[0]}
        </button>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Flag;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-lg px-3 py-2 text-[11.5px] font-bold',
        danger
          ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
          : 'bg-ink-100 dark:bg-white/10',
      )}
    >
      <Icon size={12} /> {label}
    </button>
  );
}
