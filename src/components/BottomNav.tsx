import { Home, MessageCircle, Plus, Search, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { cn, vibrate } from '../lib/utils';

export function BottomNav() {
  const { pathname } = useLocation();
  const chats = useStore((s) => s.chats);
  const user = useStore((s) => s.user);
  const unread = chats.reduce(
    (n, c) =>
      c.archived ? n : n + c.messages.filter((m) => m.senderId !== 'me' && !m.read).length,
    0,
  );

  const links = [
    { to: '/', icon: Home, label: 'Home', match: (p: string) => p === '/' },
    { to: '/search', icon: Search, label: 'Browse', match: (p: string) => p.startsWith('/search') },
    null,
    {
      to: '/chats',
      icon: MessageCircle,
      label: 'Chats',
      badge: unread,
      match: (p: string) => p.startsWith('/chats'),
    },
    {
      to: user ? '/profile' : '/login',
      icon: User,
      label: user ? 'You' : 'Sign in',
      match: (p: string) => p.startsWith('/profile') || p.startsWith('/myads'),
    },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-xl lg:hidden"
      style={{
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        borderColor: 'var(--line)',
      }}
    >
      <div className="safe-bottom mx-auto flex max-w-md items-center justify-around px-2">
        {links.map((link, i) =>
          !link ? (
            <div key="fab" className="relative -mt-6 flex w-16 justify-center">
              <Link
                to="/post"
                aria-label="Post an ad"
                onClick={() => vibrate(12)}
                className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-glow transition-transform active:scale-90"
                style={{ background: 'linear-gradient(140deg,#0AA98C,#067A66)' }}
              >
                <Plus size={26} strokeWidth={2.6} />
              </Link>
            </div>
          ) : (
            <NavItem key={i} {...link} active={link.match(pathname)} />
          ),
        )}
      </div>
    </nav>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
  badge,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      onClick={() => vibrate(6)}
      className={cn(
        'relative flex min-w-[62px] flex-col items-center gap-1 px-2 pb-2 pt-2.5 transition-colors',
        active ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400 dark:text-ink-300',
      )}
    >
      <span className="relative">
        <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
        {!!badge && badge > 0 && (
          <span className="absolute -right-2 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-ink-900">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className={cn('text-[10.5px] leading-none', active ? 'font-bold' : 'font-medium')}>
        {label}
      </span>
      {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-500" />}
    </Link>
  );
}
