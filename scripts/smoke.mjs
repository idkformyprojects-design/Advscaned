/**
 * Headless smoke test: renders the real bundle in jsdom and visits every route,
 * asserting that each page produces content and logs no React errors.
 * Run: node scripts/smoke.mjs
 */
import { JSDOM } from 'jsdom';

const routes = [
  '/',
  '/search',
  '/search?q=iphone',
  '/search?cat=cars&max=600000&sort=price-asc',
  '/ad/ad-1',
  '/ad/ad-7',
  '/ad/ad-15',
  '/login',
  '/notifications',
  '/seller/u1',
  '/favorites',
  '/chats',
  '/chats/chat-1',
  '/myads',
  '/insights',
  '/profile',
  '/saved',
  '/post',
  '/nope',
];

const errors = [];

async function main() {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="root"></div><div id="boot"></div></body></html>`,
    { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' },
  );

  const { window } = dom;
  window.matchMedia = (q) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollTo = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.navigator.vibrate = () => true;

  for (const key of [
    'window',
    'document',
    'navigator',
    'localStorage',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'SVGElement',
    'Element',
    'HTMLDivElement',
    'DocumentFragment',
    'Node',
    'Event',
    'MouseEvent',
    'CustomEvent',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'getComputedStyle',
    'matchMedia',
    'location',
  ]) {
    try {
      globalThis[key] = window[key];
    } catch {
      /* some globals are read-only */
    }
  }
  globalThis.self = window;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const origError = console.error;
  console.error = (...args) => {
    const msg = args.map(String).join(' ');
    if (!msg.includes('not wrapped in act')) errors.push(msg);
    origError(...args);
  };
  window.addEventListener('error', (e) => errors.push('window error: ' + e.message));

  if (process.env.SMOKE_AUTH) {
    window.localStorage.setItem(
      'bazaar-store-v1',
      JSON.stringify({
        state: {
          user: {
            id: 'me',
            name: 'Arjun Sen',
            phone: '+91 98300 12345',
            area: 'Salt Lake',
            avatarColor: '#0AA98C',
            joined: Date.now(),
          },
          onboarded: true,
        },
        version: 1,
      }),
    );
  }

  await import('../.tmp/smoke.mjs');
  await new Promise((r) => setTimeout(r, 300));

  const results = [];
  for (const route of routes) {
    window.history.pushState({}, '', route);
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
    await new Promise((r) => setTimeout(r, 220));
    const root = window.document.getElementById('root');
    const text = (root?.textContent ?? '').replace(/\s+/g, ' ').trim();
    results.push({ route, chars: text.length, head: text.slice(0, 90) });
  }

  let failed = 0;
  for (const r of results) {
    const ok = r.chars > 40;
    if (!ok) failed++;
    console.log(
      `${ok ? '✓' : '✗'} ${r.route.padEnd(38)} ${String(r.chars).padStart(5)} chars  ${r.head}`,
    );
  }
  if (errors.length) {
    console.log('\n--- console errors ---');
    errors.slice(0, 25).forEach((e) => console.log('·', e.slice(0, 300)));
  }
  console.log(
    `\n${results.length - failed}/${results.length} routes rendered${errors.length ? `, ${errors.length} errors` : ', no errors'}`,
  );
  process.exit(failed || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error('SMOKE FAILED', e);
  process.exit(1);
});
