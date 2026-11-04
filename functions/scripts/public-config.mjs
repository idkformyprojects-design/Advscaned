/**
 * Writes config/public so the app knows whether boosts are paid (Razorpay configured).
 *   GCLOUD_PROJECT=<project> RAZORPAY_KEY_ID=<key or empty> node scripts/public-config.mjs
 */
import { adminDb } from './admin.mjs';

const cfg = {
  payments: Boolean(process.env.RAZORPAY_KEY_ID?.trim()),
  boostPricePaise: 14_900,
  boostDays: 7,
};
await adminDb().doc('config/public').set(cfg);
console.log('config/public =', JSON.stringify(cfg));
