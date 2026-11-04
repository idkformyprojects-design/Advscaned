import { Link } from 'react-router-dom';
import { Bell, CheckCheck, MessageCircle, Sparkles, Tag, TrendingDown, Zap } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { EmptyState } from '../components/ui';
import { useStore } from '../lib/store';
import { cn, timeAgo } from '../lib/utils';

const ICONS = {
  price: TrendingDown,
  chat: MessageCircle,
  boost: Zap,
  match: Sparkles,
  system: Tag,
} as const;

const TONES = {
  price: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  chat: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  boost: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  match: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  system: 'bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200',
} as const;

export default function Notifications() {
  const notifications = useStore((s) => s.notifications);
  const markAll = useStore((s) => s.markAllNotificationsRead);
  const markOne = useStore((s) => s.markNotificationRead);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-3xl">
      <TopBar
        back="/"
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'All caught up'}
        right={
          unread > 0 ? (
            <button
              onClick={markAll}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-[11.5px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={26} />}
          title="No notifications"
          body="Price drops, replies and matches will land here."
        />
      ) : (
        <div className="divide-hair">
          {notifications.map((n) => {
            const Icon = ICONS[n.type];
            return (
              <Link
                key={n.id}
                to={n.href ?? '#'}
                onClick={() => markOne(n.id)}
                className={cn(
                  'flex gap-3 px-4 py-3.5 transition-colors hover:bg-ink-50/60 dark:hover:bg-white/5',
                  !n.read && 'bg-brand-50/40 dark:bg-brand-500/[0.06]',
                )}
              >
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                    TONES[n.type],
                  )}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        'truncate text-[13.5px]',
                        n.read ? 'font-semibold' : 'font-bold',
                      )}
                    >
                      {n.title}
                    </p>
                    <span className="shrink-0 text-[10.5px] text-muted">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                    {n.body}
                  </p>
                </div>
                {!n.read && <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
