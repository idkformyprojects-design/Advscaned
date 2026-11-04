import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-lg">
      <EmptyState
        icon={<Compass size={26} />}
        title="Page not found"
        body="The link may be broken, or the ad was removed. Let's get you back to the good stuff."
        action="Go home"
        onAction={() => navigate('/')}
      />
    </div>
  );
}
