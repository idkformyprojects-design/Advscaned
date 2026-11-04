import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { openDb } from './db.js';
import { createApp, normalizePhone } from './app.js';

/*
 * Bazaar API server.
 *   node server/index.js
 *
 * Environment:
 *   PORT                 default 8787
 *   DATABASE_PATH        SQLite file, default server/data/bazaar.db
 *   UPLOADS_DIR          default server/data/uploads
 *   PUBLIC_URL           public base URL for uploaded image links (e.g. https://api.example.com)
 *   CORS_ORIGINS         comma-separated allowed origins, default "*"
 *   OTP_SECRET           random string used to hash OTPs — REQUIRED in production
 *   OTP_DEV_CODE         fixed OTP returned to the client (demo/dev only, e.g. 1234). Never set in production.
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM   → send OTP by Twilio SMS
 *   SMS_WEBHOOK_URL [+ SMS_WEBHOOK_TOKEN]                → or POST {phone, code, message} to your SMS provider
 *   DEMO_AUTOREPLY       "0" turns off automatic replies from the seeded demo sellers
 *   ADMIN_PHONES         comma-separated mobile numbers that get moderator access on sign-in
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET  → paid boosts (₹149 / 7 days). Without them boosts are free.
 *   RAZORPAY_WEBHOOK_SECRET               → verifies POST /api/payments/webhook
 */

const env = process.env;
const production = env.NODE_ENV === 'production';

if (production && !env.OTP_SECRET) {
  console.error('OTP_SECRET must be set in production.');
  process.exit(1);
}

async function sendSms(phone, code) {
  const message = `${code} is your Bazaar code. It expires in 5 minutes. Never share it with anyone.`;
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: env.TWILIO_FROM, Body: message }),
      },
    );
    if (!res.ok) throw new Error(`Twilio responded ${res.status}`);
    return;
  }
  if (env.SMS_WEBHOOK_URL) {
    const res = await fetch(env.SMS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.SMS_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify({ phone, code, message }),
    });
    if (!res.ok) throw new Error(`SMS webhook responded ${res.status}`);
    return;
  }
  throw new Error('No SMS provider configured');
}

const hasSms = !!(env.TWILIO_ACCOUNT_SID || env.SMS_WEBHOOK_URL);
const devOtpCode = env.OTP_DEV_CODE || (!production && !hasSms ? '1234' : undefined);

const db = openDb(resolve(env.DATABASE_PATH ?? 'server/data/bazaar.db'));
const app = createApp({
  db,
  otpSecret: env.OTP_SECRET ?? 'bazaar-dev-secret',
  devOtpCode,
  sendSms: hasSms ? sendSms : undefined,
  uploadsDir: resolve(env.UPLOADS_DIR ?? 'server/data/uploads'),
  publicUrl: env.PUBLIC_URL,
  corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : '*',
  demoReplyMs: env.DEMO_AUTOREPLY === '0' ? false : 1800,
  adminPhones: (env.ADMIN_PHONES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalizePhone),
  payments:
    env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
      ? {
          keyId: env.RAZORPAY_KEY_ID,
          keySecret: env.RAZORPAY_KEY_SECRET,
          webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
        }
      : undefined,
});

const port = Number(env.PORT ?? 8787);
const server = createServer(app);
server.listen(port, () => {
  console.log(`Bazaar API listening on http://localhost:${port}`);
  if (devOtpCode) console.log(`  ⚠ Demo OTP mode — every login code is ${devOtpCode}`);
  else console.log('  OTPs are sent by SMS');
  console.log(env.RAZORPAY_KEY_ID ? '  Boosts are paid via Razorpay' : '  Boosts are free (Razorpay not configured)');
});

const shutdown = () => {
  app.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
