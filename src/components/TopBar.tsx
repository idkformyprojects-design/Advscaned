import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export function TopBar({
  title,
  subtitle,
  back,
  right,
  left,
  transparent,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  back?: boolean | string;
  right?: ReactNode;
  left?: ReactNode;
  transparent?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center gap-2 px-4 py-2.5',
        !transparent && 'border-b backdrop-blur-xl',
        className,
      )}
      style={
        transparent
          ? undefined
          : {
              background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
              borderColor: 'var(--line)',
            }
      }
    >
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          aria-label="Go back"
          className="-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full active:scale-90 active:bg-ink-100 dark:active:bg-white/10"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {left}
      <div className="min-w-0 flex-1">
        {title && <h1 className="truncate text-[16px] font-bold tracking-tight">{title}</h1>}
        {subtitle && <p className="truncate text-[11.5px] text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{right}</div>
    </header>
  );
}

export function IconButton({
  icon: Icon,
  label,
  to,
  onClick,
  badge,
  className,
}: {
  icon: LucideIcon;
  label: string;
  to?: string;
  onClick?: () => void;
  badge?: number;
  className?: string;
}) {
  const inner = (
    <>
      <Icon size={20} strokeWidth={2} />
      {!!badge && badge > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold leading-none text-white ring-2 ring-white dark:ring-ink-900">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </>
  );
  const cls = cn(
    'relative grid h-10 w-10 place-items-center rounded-full transition active:scale-90 active:bg-ink-100 dark:active:bg-white/10',
    className,
  );
  if (to)
    return (
      <Link to={to} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button aria-label={label} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
