export type CategoryId =
  | 'cars'
  | 'mobiles'
  | 'properties'
  | 'bikes'
  | 'electronics'
  | 'furniture'
  | 'fashion'
  | 'jobs'
  | 'pets'
  | 'services'
  | 'sports'
  | 'books';

export type Condition = 'new' | 'like-new' | 'good' | 'fair';

/** pending = hidden while moderators review it; removed = taken down by moderators. */
export type AdStatus = 'active' | 'sold' | 'draft' | 'pending' | 'removed';

export interface Seller {
  id: string;
  name: string;
  phone: string;
  avatarColor: string;
  rating: number;
  reviews: number;
  joined: string;
  verified: boolean;
  responseRate: number;
  responseTime: string;
  bio?: string;
  memberSince?: string;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  price: number;
  category: CategoryId;
  condition: Condition;
  images: string[];
  area: string;
  city: string;
  distanceKm: number;
  sellerId: string;
  createdAt: number;
  views: number;
  saves: number;
  featured?: boolean;
  boosted?: boolean;
  negotiable?: boolean;
  status: AdStatus;
  attributes: Record<string, string>;
  delivery?: boolean;
  warranty?: string;
  /** Every price the ad has carried, oldest first. */
  priceHistory?: { price: number; at: number }[];
  /** When a paid boost ends (API mode). */
  boostedUntil?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: number;
  read: boolean;
  kind?: 'text' | 'offer' | 'system';
  offerAmount?: number;
}

export interface Chat {
  id: string;
  adId: string;
  buyerId: string;
  sellerId: string;
  messages: Message[];
  lastMessageAt: number;
  archived?: boolean;
}

export interface Review {
  id: string;
  sellerId: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  type: 'price' | 'chat' | 'system' | 'boost' | 'match';
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  href?: string;
}

export interface SavedSearch {
  id: string;
  label: string;
  query: string;
  category?: CategoryId;
  maxPrice?: number;
  minPrice?: number;
  createdAt: number;
  alerts: boolean;
}

export interface Filters {
  query: string;
  category?: CategoryId;
  minPrice?: number;
  maxPrice?: number;
  condition?: Condition[];
  maxDistance?: number;
  sort: 'relevance' | 'newest' | 'price-asc' | 'price-desc' | 'distance';
  verifiedOnly: boolean;
  withPhotos: boolean;
}

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  area: string;
  avatarColor: string;
  joined: number;
  /** Account id on the Bazaar API when signed in against a backend. */
  remoteId?: string;
  /** 'admin' unlocks the moderation screen (API mode). */
  role?: 'user' | 'admin';
}

export const CATEGORY_ATTRS: Record<
  string,
  { key: string; label: string; options?: string[]; type?: 'text' | 'number' }[]
> = {};
