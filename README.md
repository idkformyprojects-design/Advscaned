# Bazaar — Buy. Sell. Nearby.

[![CI](https://github.com/shahidraza-design/Advscaned/actions/workflows/ci.yml/badge.svg)](https://github.com/shahidraza-design/Advscaned/actions/workflows/ci.yml)

A complete, production-quality **OLX-class classifieds marketplace** built as an installable mobile web app (PWA) with a ready-to-build **Android APK** shell via Capacitor.

Think OLX / Facebook Marketplace, but with a modern design system, an AI assist layer, and real marketplace mechanics: posting wizard, search with filters, in-app chat with offers, favourites, saved-search alerts, seller profiles, ad promotion and analytics.

> **Preview:** `npm run dev` → the app runs on port `5173`.
> **Demo login:** any 10-digit phone number, then OTP `1234` (nothing is sent — it's a local demo).

---

## 1. Getting the APK

The app ships three ways:

**a. Installable PWA (zero setup)** — open the deployed URL on a phone → browser menu → _Add to Home screen_. Full-screen, offline-capable, launcher icon.

**b. Prebuilt debug APK from CI (no local tooling)** — every push builds one on GitHub's runners:

> **Actions → CI → latest run → Artifacts → `bazaar-debug-apk`**
> → <https://github.com/shahidraza-design/Advscaned/actions/workflows/ci.yml>

The artifact is a real signed-for-debug `app-debug.apk` (~9 MB) you can sideload on any Android 7+ device (enable “install unknown apps” first). Built with JDK 21 + Android SDK 36, `minSdkVersion 24`.

**c. Build it yourself**

```bash
npm install && npm run build
npx cap sync android          # the android/ project is committed
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

**d. Signed release for the Play Store**

Signing is already wired into `android/app/build.gradle`; you only create the key once:

```bash
bash scripts/make-keystore.sh      # → android/bazaar-release.jks + android/keystore.properties (git-ignored)
cd android && ./gradlew bundleRelease assembleRelease
# → app/build/outputs/bundle/release/app-release.aab   (upload to Play Console)
# → app/build/outputs/apk/release/app-release.apk      (signed, installable)
```

To let CI build signed releases, add the three secrets the script prints
(`BAZAAR_KEYSTORE_BASE64`, `BAZAAR_KEYSTORE_PASSWORD`, `BAZAAR_KEY_ALIAS`) under
**Settings → Secrets and variables → Actions**, then publish a version by pushing a tag:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

The **Release** workflow builds the signed `.aab` + `.apk`, verifies the signatures and attaches
both to a GitHub Release. `versionCode` increases automatically on every run, as Play requires.

> Back up the `.jks` file and its password somewhere safe (a password manager). When you create
> the app in Play Console, keep **Play App Signing** on — then this key is only your *upload* key
> and Google can reset it if it's ever lost.

App id `com.bazaar.marketplace`, launcher icons, splash colours and the WebView shell are already wired up.

---

## 2. Feature set

### Discovery & browsing

- **Home feed** with location-aware recommendations, category grid, featured rail, "fresh / near you / under ₹35k / top picks" tabs, trending searches and recent views.
- **Search** with URL-shareable state: query, category, price range, condition, distance, verified-only, photo-only.
- **Relevance ranking** that blends text match, freshness, locality, demand signals and promotions.
- **Live search suggestions**: matching categories, real ad titles with prices, and popular searches as you type.
- **Voice search** via the Web Speech API (graceful fallback when unsupported).
- **Map browse mode**: a custom SVG neighbourhood map of Kolkata (river, parks, arterials, area labels) with price pins, tap-to-preview cards, a “you are here” marker and the same filters applied as the list.
- **Sorting**: recommended, newest, price asc/desc, nearest.
- **Filter pills**, one-tap clearing, and a **save-this-search** action with alerts.
- **Empty states**, skeleton-free instant filtering (data is local), and 4/3/2-column responsive grids.

### Listings

- Rich **ad detail page**: swipeable gallery + full-screen photo viewer, condition/category badges, specifications table, description expand, map-style location card, safety guidance, view counts, similar ads.
- **Price intelligence**: comparable-listing analysis tells buyers/sellers whether a price is above or below market, with confidence and the comps used.
- **Seller card** with rating, verified badge, response rate, member-since and a full **seller profile** page.
- **Buyer reviews**: star summary with distribution bars, review feed, and a write-a-review sheet (rating + text) that posts instantly.
- **Price-drop history**: ask price changes are timestamped, buyers see “price reduced 12% · was ₹59,000”, cards show a ↓% badge.
- **Report ad**, **share** (Web Share API with clipboard fallback), **favourite**, **views tracking**.

### Selling

- **4-step posting wizard**: category → details → location → review.
- **Photo upload** with automatic client-side resize/compression (6 photos, cover selection).
- **Dynamic category fields** (fuel, transmission, BHK, storage, breed, …) per category.
- **AI assist**: suggested titles, one-tap description writer, and a **price assistant** that recommends a range from live comparables.
- Negotiable flag, delivery flag, location picker, draft saving, live preview before publish.

### Messaging & deals

- **Chat threads** with ad context, quick replies, typing indicator, read receipts, unread badges and day separators.
- **Make an offer** flow (pre-filled suggestions) that posts a structured offer message.
- **Phone reveal** with masking, safety reminders, **report seller** (reason picker) and **block / unblock** (hides their chats and ads).
- Chat list search across seller names, item titles and messages.
- Chat list with search, previews and per-chat badges.

### Account & growth

- **Phone + OTP sign-in** (simulated), name + area onboarding, guest browsing with auth gates.
- **My ads** dashboard: views/saves/live stats, edit any ad, finish & publish drafts, mark sold, relist, delete, and **lower-price with suggested cuts**.
- **Seller insights**: 7/30-day view trend chart, unique buyers, save rate, buyer funnel (views → saves → chats → deals), per-ad sparklines with momentum, and ranked “what to do next” tips.
- **Boost** flow (simulated checkout) → featured placement + notification.
- **Saved ads**, **saved searches** with alert toggles and live match counts.
- **Notification centre** (price drops, replies, matches, boosts, system) with unread state.
- **Dark mode**, area switcher, demo-data reset, safety centre.
- **First-run onboarding**: three-slide value tour, shown once and persisted.
- **Local notifications**: opt-in browser alerts when a seller replies while you are in another tab.
- **Install prompt** (beforeinstallprompt), offline service worker with an **offline banner** and reconnect toast, PWA manifest with shortcuts.

---

## 3. Tech stack

| Layer   | Choice                                                   | Why                                                       |
| ------- | -------------------------------------------------------- | --------------------------------------------------------- |
| UI      | **React 18 + TypeScript**                                | Typed, component-driven, fast iteration                   |
| Build   | **Vite 5**                                               | Instant HMR, tiny config, great PWA story                 |
| Styling | **Tailwind CSS 3.4** + CSS custom-property design tokens | Consistent theming, dark mode, zero runtime CSS cost      |
| State   | **Zustand** + `persist` middleware                       | One small store, localStorage persistence, no boilerplate |
| Routing | **React Router 6**                                       | Nested shell + auth guards + shareable query state        |
| Motion  | **Framer Motion**                                        | Sheet transitions, micro-interactions                     |
| Icons   | **Lucide**                                               | Consistent 2px iconography                                |
| Native  | **Capacitor 8**                                          | Wraps the same build into an Android APK                  |
| Quality | `tsc --noEmit`, custom jsdom smoke test                  | Route-level render verification                           |

No backend is required to run the demo — the store acts as an offline repository so every flow is fully functional. Swapping in a real API means replacing the store actions (`src/lib/store.ts`) with fetch calls; the shapes in `src/lib/types.ts` are already API-ready.

---

## 4. Design system

- **Palette:** deep ink `#0B1220` for type, brand teal `#0AA98C → #067A66` for actions, amber `#FFB703` for promotion, rose for destructive states.
- **Surfaces:** soft canvas `#F4F6F8`, white cards, 1px hairline borders, layered shadows (`card`, `float`, `glow`).
- **Dark mode:** true-black canvas `#060B14` with elevated `#0F1725` surfaces — applied before first paint (no flash).
- **Type:** Inter/system stack, tight tracking on headings, 10.5–13.5px supporting text, tabular pricing.
- **Shape language:** 12–24px radii, pill chips, bottom sheets with grabbers, circular icon buttons.
- **Layout:** mobile-first app shell (sticky header + bottom tab bar with centre **Sell** FAB); on desktop it becomes a 1280px marketplace with a top nav, hero, and 4-column grid.
- **Accessibility:** 44px touch targets, labelled icon buttons, `prefers-reduced-motion` support, focus rings on inputs, semantic headings.

---

## 5. Project structure

```
src/
├── App.tsx                 # routes + auth guards + theme
├── main.tsx                # bootstrap, splash removal, SW registration
├── index.css               # design tokens, component classes, utilities
├── components/
│   ├── AppShell.tsx        # desktop header, toaster, install banner, footer
│   ├── BottomNav.tsx       # mobile tab bar + Sell FAB
│   ├── TopBar.tsx          # page header + icon buttons
│   ├── AdCard.tsx          # grid card, thumb, favourite button, row variant
│   ├── MapView.tsx         # SVG neighbourhood map with price pins
│   ├── Onboarding.tsx      # first-run value tour
│   ├── ErrorBoundary.tsx   # screen-level crash recovery
│   └── ui.tsx              # Sheet, Avatar, Badge, EmptyState, Toggle, …
├── lib/
│   ├── types.ts            # domain model (Ad, Chat, Seller, Filters, …)
│   ├── insights.ts         # deterministic analytics, sparklines, funnel, tips
│   ├── geo.ts              # neighbourhood coordinates, projection, distance
│   ├── data.ts             # categories, dynamic fields, sellers, areas
│   ├── seed.ts             # 16 realistic listings, chats, notifications
│   ├── store.ts            # Zustand marketplace store + toasts
│   ├── ai.ts               # pricing, description writer, title hints, ranking
│   ├── hooks.ts            # seller resolution ("me" support)
│   └── utils.ts            # INR formatting, time, image compression, share
└── pages/                  # Home, Search, AdDetail, PostAd, Chats, ChatThread,
                            # Favorites, SavedSearches, MyAds, Insights, Profile,
                            # Login, Notifications, SellerProfile, NotFound
public/
├── manifest.webmanifest    # PWA metadata, shortcuts, maskable icons
├── sw.js                   # offline shell + runtime caching
├── icons/                  # generated PNG/SVG icons
└── images/                 # listing photography
scripts/
├── make-icons.mjs          # dependency-free PNG icon generator (web + Android)
└── smoke.mjs               # jsdom render test for every route
```

---

## 6. CI

`.github/workflows/ci.yml` runs two jobs on every push and pull request:

| Job             | What it does                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Web checks**  | `npm ci` → `tsc` → 20-route smoke → interaction flows → production build → uploads `web-build` |
| **Android APK** | JDK 21 + Android SDK 36 → `cap sync` → `./gradlew assembleDebug` → uploads `bazaar-debug-apk`     |
| **Release** (`release.yml`, on `v*` tags) | signed `bundleRelease` + `assembleRelease` → signature check → GitHub Release |

Both jobs currently pass in ~2 minutes.

## 7. Scripts

```bash
npm run dev         # Vite dev server on 0.0.0.0:5173
npm run build       # type-check + production build → dist/
npm run preview     # serve the production build (service worker active)
npm run typecheck   # tsc --noEmit

npm run smoke       # render every route in jsdom (guest + signed-in), assert no errors
npm run flows       # drive real UI flows: sign-in → post → boost → chat → filters → dark mode
npm run verify      # typecheck + smoke + flows + build  ← the full gate
npm run icons       # regenerate web + Android launcher icons
```

`npm run flows` is a genuine interaction suite — it types into controlled inputs, opens
sheets, publishes an ad, waits for the seller's auto-reply, applies filters and toggles dark
mode, asserting the resulting DOM — including the price-drop flow, insights dashboard, report/block, chat search and draft → publish. Both suites run on the real bundle, so they catch broken
props, bad routes and runtime errors without a browser binary.

---

## 8. Making it production-ready

The demo is intentionally backend-free. To ship for real:

1. **API + DB** (Postgres/Prisma or Firebase) behind the store actions; add image uploads to S3/Cloudinary.
2. **Real auth** — phone OTP via MSG91/Twilio, refresh tokens, device sessions.
3. **Realtime chat** — WebSockets or Firestore; attachments, push notifications (FCM/APNs).
4. **Payments & escrow** — Razorpay/Stripe for boosts and Safe Pay.
5. **Maps & geo** — Mapbox/Google Places for precise distance and radius search.
6. **Moderation** — image/text classifiers, duplicate detection, admin review queue.
7. **Server-side AI** — swap `src/lib/ai.ts` heuristics for an LLM endpoint for descriptions and price models.

---

Built with React, TypeScript and Tailwind — designed for buyers and sellers in Kolkata. 🇮🇳
