# HANDOFF — Bazaar marketplace

Everything a new developer (or AI agent) needs to continue this project.

---

## 1. What this is

**Bazaar** is a complete OLX-style classifieds marketplace, built as an installable PWA with a
Capacitor Android shell.

- **Stack:** React 18 · TypeScript (strict) · Vite 5 · Tailwind 3.4 · Zustand (+persist) ·
  React Router 6 · Framer Motion · lucide-react · Capacitor 8 · **API:** Node 22 `node:http` +
  `node:sqlite` (zero npm dependencies)
- **Two modes, same UI.** Built _without_ `VITE_API_URL` the Zustand store is the whole data layer
  (persisted to `localStorage`, key `bazaar-store-v1`) and every flow works offline as a demo.
  Built _with_ `VITE_API_URL` the store stays the UI cache but every action is synced to the API in
  `server/` (real accounts, OTP, photos, chat).
- **Status:** feature-complete. 20 routes render, the interaction flows pass, 13 API tests and an
  app↔API sync test pass, CI builds a debug APK on every push and a signed AAB/APK on `v*` tags.

---

## 2. Quickstart

```bash
npm install
npm run dev        # http://localhost:5173  (binds 0.0.0.0)
```

Demo login: **any 10-digit phone number**, then OTP **`1234`**. No SMS is sent.

```bash
npm run verify     # typecheck + smoke + flows + API tests + sync test + build  ← before committing
npm run build
npm run preview    # production build, service worker active
```

With the backend (needs Node 22.18+):

```bash
npm run server                               # API on :8787, demo OTP 1234
VITE_API_URL=http://localhost:8787 npm run dev
```

---

## 3. Where things live

```
src/
├── App.tsx              routes, RequireAuth guards, theme class
├── main.tsx             bootstrap, splash removal, SW registration
├── index.css            design tokens + component classes (.card .chip .btn .input .sheet)
├── components/
│   ├── AppShell.tsx     desktop header, footer, toaster, install banner, offline banner
│   ├── BottomNav.tsx    mobile tab bar + centre Sell FAB
│   ├── TopBar.tsx       per-page header + IconButton
│   ├── AdCard.tsx       grid card, AdThumb/SafeImage, favourite, priceDrop helper
│   ├── MapView.tsx      SVG Kolkata map: river, parks, roads, price pins, preview card
│   ├── Onboarding.tsx   3-slide first-run tour (gated by store.onboarded)
│   ├── ErrorBoundary.tsx screen-level crash UI
│   └── ui.tsx           Sheet, Avatar, Badge, EmptyState, Toggle, Stepper, Spinner
├── lib/
│   ├── types.ts         domain model — Ad, Chat, Message, Review, Seller, Filters…
│   ├── data.ts          CATEGORIES (+per-category form fields), SELLERS, AREAS
│   ├── seed.ts          16 listings, chats, notifications, reviews, saved searches
│   ├── store.ts         Zustand store + actions + toasts (useUI)
│   ├── api.ts           typed API client — on only when VITE_API_URL is set
│   ├── sync.ts          pushes store actions to the API, bootstrap + 5 s polling
│   ├── hooks.ts         useSeller(id) — resolves "me" to the signed-in user
│   ├── ai.ts            price suggestion, description writer, title hints, ranking
│   ├── insights.ts      deterministic analytics, sparklines, funnel, seller tips
│   ├── geo.ts           area coordinates, projection, haversine, pin labels
│   └── utils.ts         INR formatting, timeAgo, image compression, share, cn()
└── pages/               Home, SearchPage, AdDetail, PostAd (also /post/:id to edit), Chats,
                         ChatThread, Favorites, SavedSearches, MyAds, Insights, Profile, Login,
                         Notifications, SellerProfile, Admin (/admin, moderators), NotFound
server/
├── index.js             env config (see header comment), SMS sending, startup
├── app.js               all routes, auth, validation, notifications
├── db.js                SQLite schema, idempotent migrations, demo seeding from seed.json
├── seed.json            regenerate with `npm run server:seed-json` after editing src/lib/seed.ts
└── test/                api.test.js (core) + next.test.js (live stream, payments, moderation)
```

---

## 4. Data layer (read this before touching state)

`src/lib/store.ts` — single Zustand store, persisted with `partialize` (everything except toasts).

Key state: `user`, `ads`, `chats`, `favorites`, `recentlyViewed`, `notifications`, `savedSearches`,
`reviews`, `theme`, `area`, `onboarded`.

Important actions:

| Action                                                              | Notes                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `login(name, phone, area)`                                          | offline mode only; API mode signs in via `api.verifyOtp` + `completeSignIn()` in sync.ts                            |
| `createAd(ad)` / `updateAd` / `deleteAd`                            | ads created by the user use `sellerId: 'me'`                                                                        |
| `boostAd(id)`                                                       | sets `featured` + `boosted`, pushes a notification                                                                  |
| `dropPrice(id, price)`                                              | appends to `ad.priceHistory`, pushes a notification                                                                 |
| `startChat(adId)` → id                                              | reuses the existing chat for that ad if present                                                                     |
| `sendMessage(chatId, text, kind)`                                   | appends message; offline → simulated seller reply after ~1.4s; API mode → sent to server, replies arrive by polling |
| `blockSeller` / `unblockSeller` / `report`                          | block hides the seller's chats + ads; unblock from Profile                                                          |
| `addReview(r)` / `addSavedSearch` / `toggleFavorite` / `markViewed` | …                                                                                                                   |
| `resetDemo()`                                                       | restores seed data (Profile → Reset demo data)                                                                      |

**API mode:** every mutating action calls `remote.*` in `src/lib/sync.ts` right after its optimistic
`set()`. The server's id for the signed-in user is mapped to `'me'` (so `sellerId: 'me'` keeps working)
and a chat's `sellerId` is always the _other_ person. New actions that change shared data need a
matching `remote.*` call and server route. `connectStream()` keeps an EventSource on `/api/stream`;
each `update` event triggers an immediate `/api/updates` fetch (polling drops to every 30 s while
the stream is live). Paid boosts go through `payForBoost()` (Razorpay Checkout → `/api/payments/verify`).
Ad statuses `pending` (hidden for review) and `removed` (by moderators) are server-controlled.

**Resetting during development:** DevTools → Application → Local Storage → delete
`bazaar-store-v1`, or use the in-app reset. Bump the `version` in `persist` if you change the shape.

---

## 5. Design conventions

- Tokens live in `src/index.css` as CSS variables (`--surface`, `--line`, `--brand`, `--map-*`) and are
  consumed by both Tailwind classes and inline styles. **Dark mode = `.dark` on `<html>`**.
- Reusable classes: `.card`, `.chip` / `.chip-on`, `.btn` + `.btn-primary|outline|soft`, `.input`,
  `.label`, `.hairline`, `.divide-hair`, `.safe-bottom`, `.pb-nav`, `.no-scrollbar`.
- Mobile-first: bottom tab bar + sheets; `lg:` breakpoint switches to a deskop header and wide grids.
- Motion is subtle (Framer Motion only for sheets/onboarding); `prefers-reduced-motion` respected.
- Icons: lucide-react, 1.9–2.4px strokes, 16–22px sizes.

---

## 6. Tests

```bash
npm run smoke   # bundles src/main.tsx with esbuild, renders 19 routes in jsdom (guest + signed-in)
npm run flows   # drives the real UI: sign-in, post, price drop, boost, map, reviews, chat,
                # chat search, report/block, draft → publish, filters
npm run server:test  # API: auth, ads, favourites, chat, reviews, blocks, uploads
npm run test:sync    # runs the real store + sync.ts against a live in-process API
```

Both run against the actual bundle (`npm run test:bundle` builds `.tmp/smoke.mjs`). If you add a page,
add its route to `routes` in `scripts/smoke.mjs`. If you add a flow, extend `scripts/flows.mjs` —
`click()`, `type(value, {placeholder})` and `goto(route)` helpers are already there. Note jsdom needs
the DOM globals list at the top of each script; add new ones there if a library complains.

---

## 7. Android / APK

- `android/` is the committed Capacitor project (app id `com.bazaar.marketplace`, minSdk 24).
- CI (`.github/workflows/ci.yml`) builds `bazaar-debug-apk` on every push → Actions → Artifacts.
- Locally: `npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`.
- After changing icons: `npm run icons` regenerates web PNGs **and** Android mipmaps.
- Release signing is wired up: `npm run keystore` once, add the 3 secrets it prints, push a `v*`
  tag → `.github/workflows/release.yml` publishes a signed AAB + APK (README §1d).

---

## 8. What is real vs. simulated

| Real (with the API)                                 | Still simulated / local                          |
| --------------------------------------------------- | ------------------------------------------------ |
| Phone OTP sign-in (Twilio or SMS webhook), sessions | Analytics (`insights.ts` derives from seed math) |
| Ads, drafts, edits, price history                   | Push notifications (browser-only, no FCM)        |
| Paid 7-day boosts via Razorpay (+ webhook), expiry  | Saved searches + recently viewed stay on-device  |
| Photo upload + hosting                              | Ad locations are neighbourhood centroids         |
| Live chat (SSE) with offers + read receipts         |                                                  |
| Reviews, reports, blocking, moderation + bans       |                                                  |

Offline mode (no `VITE_API_URL`) simulates everything in the left column too.

## 9. Suggested next steps (in order of value)

1. **Deploy**: API on Render (`render.yaml`) or Docker; web on Vercel/Netlify/Cloudflare; set
   `VITE_API_URL` (host settings + GitHub Actions variable), `ADMIN_PHONES`, Razorpay keys.
2. **Push**: FCM via `@capacitor/push-notifications` so replies arrive with the app closed.
3. **Scale**: SQLite → Postgres and photos → S3/Cloudinary once one server isn't enough.
4. **Auto-moderation**: image/text classifiers feeding the existing report queue.
5. **Precise location**: GPS / pin-drop per ad instead of `geo.ts` centroids.
6. **Play Store listing**: privacy policy, screenshots, data-safety form.

## 10. Gotchas

- `vite.config.ts` ignores `android/`, `ios/`, `dist/` in the watcher and sets `hmr.clientPort 443` +
  `wss` so proxied previews work. Change only if you change hosting.
- `public/images/*.jpg` are generated listing photos (~5 MB) — keep them out of Git LFS demands.
- `PriceLabel()` in `utils.ts` special-cases jobs (`/yr`), rent (`/mo`) and services (`from ₹`).
- Ads created by the user have `sellerId: 'me'`; resolve sellers through `useSeller()`.
  `sellerById()` is fine only for ids that can never be `'me'` (chat counterparts, block list);
  in API mode it also knows real accounts via `registerSellers()`.
- `src/lib` must stay _erasable_ TypeScript (no enums, no constructor parameter properties) —
  `test:sync` runs it directly with Node's type stripping.
- Sheets lock `#app-scroll`, the app's real scroll container (body does not scroll).
- Prettier config is committed — run `npx prettier --write "src/**/*.{ts,tsx,css}"` before pushing.

---

_Handoff generated from branch `arena/ac72d590-advscaned`. Run `git log --oneline` for the full
history of decisions._
