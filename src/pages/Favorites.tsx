import { Heart, BellPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { AdCard } from '../components/AdCard';
import { EmptyState } from '../components/ui';
import { useStore } from '../lib/store';

export default function Favorites() {
  const favorites = useStore((s) => s.favorites);
  const ads = useStore((s) => s.ads);
  const navigate = useNavigate();
  const saved = favorites.map((id) => ads.find((a) => a.id === id)).filter(Boolean) as typeof ads;

  return (
    <div className="mx-auto max-w-[1280px]">
      <TopBar
        back="/profile"
        title="Saved ads"
        subtitle={`${saved.length} item${saved.length === 1 ? '' : 's'} you're watching`}
        right={
          <Link
            to="/saved"
            className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-[11.5px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <BellPlus size={12} /> Searches
          </Link>
        }
      />

      {saved.length === 0 ? (
        <EmptyState
          icon={<Heart size={26} />}
          title="Nothing saved yet"
          body="Tap the heart on any ad to keep it here. We'll tell you if the price drops."
          action="Find something you love"
          onAction={() => navigate('/search')}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {saved.map((ad) => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>
      )}
    </div>
  );
}
