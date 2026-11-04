import type { Ad } from './types';
import { hash } from './insights';

/** Rough neighbourhood centroids across Kolkata & Howrah. */
export const AREA_COORDS: Record<string, { lat: number; lng: number }> = {
  'Salt Lake': { lat: 22.585, lng: 88.417 },
  'New Town': { lat: 22.595, lng: 88.465 },
  Rajarhat: { lat: 22.612, lng: 88.47 },
  'Lake Town': { lat: 22.601, lng: 88.4 },
  'Dum Dum': { lat: 22.621, lng: 88.421 },
  Ballygunge: { lat: 22.525, lng: 88.365 },
  'Park Street': { lat: 22.553, lng: 88.352 },
  Gariahat: { lat: 22.518, lng: 88.366 },
  Bhowanipore: { lat: 22.54, lng: 88.345 },
  Alipore: { lat: 22.534, lng: 88.331 },
  Behala: { lat: 22.5, lng: 88.31 },
  Jadavpur: { lat: 22.498, lng: 88.372 },
  Garia: { lat: 22.465, lng: 88.39 },
  Howrah: { lat: 22.585, lng: 88.318 },
};

export const MAP_BOUNDS = {
  minLat: 22.44,
  maxLat: 22.64,
  minLng: 88.285,
  maxLng: 88.5,
};

export const DEFAULT_CENTER = AREA_COORDS['Salt Lake'];

/** Deterministic jitter so pins don't stack exactly on an area centroid. */
export function adCoords(ad: Ad): { lat: number; lng: number } {
  const base = AREA_COORDS[ad.area] ?? DEFAULT_CENTER;
  const h = hash(ad.id);
  const dLat = ((h % 1000) / 1000 - 0.5) * 0.022;
  const dLng = ((Math.floor(h / 1000) % 1000) / 1000 - 0.5) * 0.026;
  return { lat: base.lat + dLat, lng: base.lng + dLng };
}

export function project(
  lat: number,
  lng: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * width;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * height;
  return { x, y };
}

export function projectAd(ad: Ad, width: number, height: number) {
  const { lat, lng } = adCoords(ad);
  return project(lat, lng, width, height);
}

/** Marker label: keep pins short on the map. */
export function pinLabel(price: number, category: string): string {
  if (category === 'jobs') return '₹' + Math.round(price / 100000) + 'L/yr';
  if (price >= 10000000) return '₹' + (price / 10000000).toFixed(1) + 'Cr';
  if (price >= 100000) return '₹' + (price / 100000).toFixed(price >= 1000000 ? 0 : 1) + 'L';
  if (price >= 1000) return '₹' + Math.round(price / 1000) + 'k';
  return '₹' + price;
}

/**
 * Distance from the buyer's chosen area to an ad, in km (one decimal).
 * Uses the same jittered coordinates as the map so the numbers always agree with it.
 */
export function adDistance(ad: Ad, fromArea: string): number {
  const from = AREA_COORDS[fromArea] ?? DEFAULT_CENTER;
  return Math.max(0.2, distanceKm(from, adCoords(ad)));
}

/** Distance in km between two coordinates (haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
