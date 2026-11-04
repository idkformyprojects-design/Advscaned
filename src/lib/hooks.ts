import { sellerById } from './data';
import { useStore } from './store';
import type { Seller } from './types';

/** Resolves a seller id, including the signed-in user ("me"). */
export function useSeller(id: string): Seller {
  const user = useStore((s) => s.user);
  if (id === 'me' && user) {
    return {
      id: 'me',
      name: user.name,
      phone: user.phone,
      avatarColor: user.avatarColor,
      rating: 5,
      reviews: 0,
      joined: new Date(user.joined).getFullYear().toString(),
      verified: true,
      responseRate: 100,
      responseTime: 'instantly',
      bio: 'New on Bazaar.',
    };
  }
  return sellerById(id);
}
