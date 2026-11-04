# HANDOFF — Bazaar marketplace

Everything a new developer (or AI agent) needs to continue this project.

---

## 1. What this is

**Bazaar** is a complete OLX-style classifieds marketplace, built as an installable PWA with a
Capacitor Android shell.

- **Stack:** React 18 · TypeScript (strict) · Vite 5 · Tailwind 3.4 · Zustand (+persist) ·
  React Router 6 · Framer Motion · lucide-react · Capacitor 7
- **No backend.** The Zustand store is the data layer and persists to `localStorage`
  (key `bazaar-store-v1`). Every flow is functional offline.
- **Status:** feature-complete demo. 19 routes render, 41 interaction assertions pass, CI builds a real
  debug APK on every push.

---

## 2. Quickstart

```bash
npm install
npm run dev        # http://localhost:5173  (binds 0.0.0.0)
```

Demo login: **any 10-digit phone number**, then OTP **`1234`**. No SMS is sent.

```bash
npm run verify     # typecheck + smoke + flows + build  ← run this before committing
npm run build
npm run preview    # production build, service worker active
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
│   ├── hooks.ts         useSeller(id) — resolves "me" to the signed-in user
│   ├── ai.ts            price suggestion, description writer, title hints, ranking
│   ├── insights.ts      deterministic analytics, sparklines, funnel, seller tips
│   ├── geo.ts           area coordinates, projection, haversine, pin labels
│   └── utils.ts         INR formatting, timeAgo, image compression, share, cn()
└── pages/               Home, SearchPage, AdDetail, PostAd, Chats, ChatThread, Favorites,
                         SavedSearches, MyAds, Insights, Profile, Login, Notifications,
                         SellerProfile, NotFound
```

---

## 4. Data layer (read this before touching state)

`src/lib/store.ts` — single Zustand store, persisted with `partialize` (everything except toasts).

Key state: `user`, `ads`, `chats`, `favorites`, `recentlyViewed`, `notifications`, `savedSearches`,
`reviews`, `theme`, `area`, `onboarded`.

Important actions:

| Action                                                              | Notes                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `login(name, phone, area)`                                          | simulated; sets `onboarded`                                                                                        |
| `createAd(ad)` / `updateAd` / `deleteAd`                            | ads created by the user use `sellerId: 'me'`                                                                       |
| `boostAd(id)`                                                       | sets `featured` + `boosted`, pushes a notification                                                                 |
| `dropPrice(id, price)`                                              | appends to `ad.priceHistory`, pushes a notification                                                                |
| `startChat(adId)` → id                                              | reuses the existing chat for that ad if present                                                                    |
| `sendMessage(chatId, text, kind)`                                   | appends message, then a **simulated seller reply** after ~1.4s (fires a browser notification if the tab is hidden) |
| `addReview(r)` / `addSavedSearch` / `toggleFavorite` / `markViewed` | …                                                                                                                  |
| `resetDemo()`                                                       | restores seed data (Profile → Reset demo data)                                                                     |

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
npm run flows   # drives the real UI: sign-in, post, price drop, boost, map, reviews, chat, filters
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
- Release build needs a keystore + `signingConfigs` (see README §1c).

---

## 8. What is real vs. simulated

| Real                                                    | Simulated / local                                |
| ------------------------------------------------------- | ------------------------------------------------ |
| All UI, routing, state transitions, filtering & ranking | Auth (any phone + OTP 1234)                      |
| Image upload + client-side compression → data URLs      | Payments/boosts (no charge)                      |
| Persistence across reloads                              | Seller replies (timed canned responses)          |
| Service worker / offline shell / install prompt         | Analytics (`insights.ts` derives from seed math) |
| CI build + APK packaging                                | Notifications (browser-only, no push backend)    |

---

## 9. Suggested next steps (in order of value)

1. **Backend**: Postgres + Prisma (or Firebase). Mirror `src/lib/types.ts` — it is already API-shaped.
   Replace store action bodies with fetch calls; keep the store as a cache.
2. **Auth**: phone OTP (MSG91/Twilio), JWT refresh, device sessions.
3. **Realtime chat**: WebSocket/Firestore + FCM push + attachments.
4. **Storage**: S3/Cloudinary for photos (drop the data-URL compression path).
5. **Payments**: Razorpay for boosts/Safe Pay; server-side price-drop alerts.
6. **Maps**: swap the hand-drawn `MapView` for Mapbox/Google with real coordinates.
7. **Moderation**: report queue, image/text classifiers, duplicate detection.
8. **Release**: signing key, `bundleRelease`, Play Store listing, privacy policy.

---

## 10. Gotchas

- `vite.config.ts` ignores `android/`, `ios/`, `dist/` in the watcher and sets `hmr.clientPort 443` +
  `wss` so proxied previews work. Change only if you change hosting.
- `public/images/*.jpg` are generated listing photos (~5 MB) — keep them out of Git LFS demands.
- `PriceLabel()` in `utils.ts` special-cases jobs (`/yr`), rent (`/mo`) and services (`from ₹`).
- Ads created by the user have `sellerId: 'me'`; resolve sellers through `useSeller()`, never
  `sellerById()` directly in components.
- Sheets lock `#app-scroll`, the app's real scroll container (body does not scroll).
- Prettier config is committed — run `npx prettier --write "src/**/*.{ts,tsx,css}"` before pushing.

---

_Handoff generated from branch `arena/ac72d590-advscaned`. Run `git log --oneline` for the full
history of decisions._
