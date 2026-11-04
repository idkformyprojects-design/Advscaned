import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a rendering failure inside one screen instead of white-screening the app.
 * In production this is where you'd report to Sentry and offer a retry.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Bazaar crashed a screen:', error.message, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
          <AlertTriangle size={28} />
        </div>
        <h1 className="mt-4 text-[19px] font-extrabold tracking-tight">Something went wrong</h1>
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
          This screen hit an unexpected error. Your ads, chats and favourites are safe — try
          reloading or heading back to the feed.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => window.location.reload()} className="btn btn-outline">
            <RotateCcw size={15} /> Reload
          </button>
          <button onClick={() => window.location.assign('/')} className="btn btn-primary">
            Back to home
          </button>
        </div>
        {import.meta.env.DEV && (
          <pre className="mt-5 max-w-full overflow-x-auto rounded-lg bg-ink-100 p-3 text-left text-[10.5px] leading-relaxed text-ink-600 dark:bg-white/5 dark:text-ink-300">
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}
