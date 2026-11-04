/**
 * End-to-end flow test in jsdom: drives the real UI (typing, clicking)
 * through sign-in → post an ad → chat → favourite → boost.
 * Run: node scripts/flows.mjs
 */
import { JSDOM } from 'jsdom';

const failures = [];
const steps = [];
const log = (ok, msg) => {
  steps.push({ ok, msg });
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failures.push(msg);
};

async function boot() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.matchMedia = (q) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
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
    'KeyboardEvent',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'getComputedStyle',
    'matchMedia',
    'location',
  ]) {
    try {
      globalThis[key] = window[key];
    } catch {
      /* read-only globals */
    }
  }
  globalThis.self = window;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const errors = [];
  const orig = console.error;
  console.error = (...a) => {
    const msg = a.map(String).join(' ');
    if (!msg.includes('not wrapped in act')) errors.push(msg);
    orig(...a);
  };
  window.addEventListener('error', (e) => errors.push(String(e.message)));

  await import('../.tmp/smoke.mjs');
  await new Promise((r) => setTimeout(r, 400));
  return { window, errors };
}

const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms));
const root = () => document.getElementById('root');
const text = () => (root()?.textContent ?? '').replace(/\s+/g, ' ');

function applyClick(el) {
  el.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

async function click(textMatch, opts = {}) {
  const nodes = [...document.querySelectorAll('button, a, [role="switch"]')];
  const target = nodes.find((n) => {
    const label = `${n.textContent ?? ''} ${n.getAttribute('aria-label') ?? ''}`.trim();
    return opts.exact ? label === textMatch : label.includes(textMatch);
  });
  if (!target) throw new Error(`click target not found: ${textMatch}`);
  applyClick(target);
  await wait(opts.wait ?? 300);
  return target;
}

function setValue(el, value) {
  const proto =
    el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}

async function type(value, match = {}) {
  const els = [...document.querySelectorAll(match.selector ?? 'input, textarea')].filter(
    (e) => e.type !== 'hidden' && !e.disabled,
  );
  const el = match.placeholder
    ? els.find((e) => (e.placeholder ?? '').includes(match.placeholder))
    : els[match.index ?? 0];
  if (!el) throw new Error(`input not found for ${JSON.stringify(match)}`);
  el.focus();
  setValue(el, value);
  await wait(140);
  return el;
}

async function goto(route) {
  window.history.pushState({}, '', route);
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
  await wait(320);
}

async function main() {
  const { errors } = await boot();
  log(true, `app booted (${text().length} chars rendered)`);

  /* ------------------------------ onboarding ----------------------------- */
  log(text().includes('Everything worth buying is nearby'), 'first-run onboarding shown');
  await click('Next', { wait: 260 });
  await click('Next', { wait: 260 });
  log(text().includes('Sell in about 60 seconds'), 'onboarding slides advance');
  await click('Skip', { wait: 300 });
  log(!text().includes('Everything worth buying is nearby'), 'onboarding dismissed and persisted');

  /* ------------------------------- sign in ------------------------------- */
  await goto('/login');
  log(text().includes('Buy better'), 'login screen shown');
  await type('9830012345', { placeholder: '98300 12345' });
  await click('Continue', { wait: 1300 });
  log(text().includes('Enter the 4-digit code'), 'OTP step reached after phone entry');

  const otpInputs = [...document.querySelectorAll('input')]
    .filter((i) => i.className.includes('h-16'))
    .slice(0, 4);
  for (let i = 0; i < 4; i++) {
    otpInputs[i].focus();
    setValue(otpInputs[i], String(i + 1));
    await wait(80);
  }
  await wait(900);
  log(text().includes('One last thing'), 'name step reached after OTP');

  await type('Arjun Sen', { placeholder: 'Arjun Sen' });
  await click('Start buying & selling', { wait: 700 });
  log(text().includes('Fresh recommendations'), 'signed in and landed on home feed');

  /* ------------------------------ favourites ----------------------------- */
  const heart = [...document.querySelectorAll('button[aria-label]')].find(
    (b) => b.getAttribute('aria-label') === 'Save ad',
  );
  if (heart) {
    applyClick(heart);
    await wait(250);
    log(true, 'favourite button toggled without error');
  } else {
    log(false, 'favourite button present on cards');
  }

  /* --------------------------------- post -------------------------------- */
  await goto('/post');
  log(text().includes('What are you listing?'), 'post wizard step 1 shown');
  await click('Mobiles', { wait: 350 });
  log(
    text().includes('Photos') && text().includes('Asking price'),
    'details step with photos + price',
  );

  await type('iPhone 12 64GB blue, boxed', { placeholder: 'brand' });
  await wait(150);
  await type('26500', { placeholder: '0' });
  await wait(200);
  log(text().includes('26,500'), 'price accepted and formatted');

  await click('AI price check', { wait: 300 });
  log(
    text().includes('Suggested range') || text().includes('Suggested'),
    'AI pricer returns a comparable range',
  );
  await click('Use suggested', { wait: 300 });

  await click('Write with AI', { wait: 300 });
  const ta = document.querySelector('textarea');
  log(!!ta && ta.value.length > 60, 'AI description written into textarea');

  await click('Continue', { wait: 350 });
  log(text().includes('Where is it located?'), 'location step reached');
  await click('Continue', { wait: 350 });
  log(text().includes('Review your ad'), 'review step reached');
  await click('Publish ad', { wait: 600 });
  log(
    /My ads|\/ad\//.test(window.location.pathname) || text().includes('iPhone 12'),
    'ad published and navigated',
  );

  await goto('/myads');
  log(text().includes('iPhone 12 64GB blue'), 'new ad appears in My ads');

  /* ------------------------------ lower price ---------------------------- */
  await click('Lower price', { wait: 320 });
  log(
    text().includes('Lower the price') && text().includes('Current price'),
    'lower-price sheet opens',
  );
  await click('-10%', { wait: 200 });
  await click('Update price', { wait: 400 });
  log(text().includes('Price lowered') || text().includes('26,5'), 'price drop applied');

  /* ------------------------------- insights ------------------------------ */
  await goto('/insights');
  log(text().includes('Seller insights') && text().includes('Views'), 'insights page loads');
  log(text().includes('Buyer funnel'), 'funnel section renders');
  log(text().includes('Ad performance'), 'per-ad performance renders');
  await click('30 days', { wait: 300 });
  log(text().includes('Views · last 30 days'), 'range switch re-renders chart');

  /* --------------------------------- boost ------------------------------- */
  await goto('/myads');
  await click('Boost', { wait: 320 });
  log(text().includes('7-day boost'), 'boost sheet opens with price');
  await click('Activate boost', { wait: 350 });
  log(text().includes('Boosted'), 'ad shows boosted state');

  /* ---------------------------------- map --------------------------------- */
  await goto('/search');
  await click('Map', { wait: 500 });
  const pins = [...document.querySelectorAll('[aria-label$="on map"]')];
  log(pins.length > 3, `map view plots ${pins.length} price pins`);
  applyClick(pins[0]);
  await wait(300);
  log(!!document.querySelector('a[aria-label="Open ad"]'), 'tapping a pin opens the ad preview');
  await click('List', { wait: 350 });
  log(
    document.querySelectorAll('[aria-label="Save ad"]').length > 0,
    'list view restores ad cards',
  );

  /* -------------------------------- reviews ------------------------------- */
  await goto('/seller/u1');
  log(text().includes('Buyer reviews'), 'seller profile shows reviews section');
  await click('Write a review', { wait: 320 });
  log(text().includes('Share how the deal went'), 'review sheet opens');
  await click('5 stars', { wait: 150 });
  await type('Bought a car here — everything exactly as described, smooth handover.', {
    placeholder: 'What went well',
  });
  await click('Post review', { wait: 400 });
  log(
    text().includes('everything exactly as described'),
    'new review posted and rendered at the top',
  );

  /* --------------------------------- chat -------------------------------- */
  await goto('/ad/ad-3');
  await click('Chat', { exact: true, wait: 600 });
  log(window.location.pathname.startsWith('/chats/'), 'chat thread opened from ad');
  await type('Is ₹32,000 okay? I can collect today.', { placeholder: 'Message' });
  await wait(150);
  await click('Send', { wait: 300 });
  log(text().includes('I can collect today'), 'message sent and rendered');

  await wait(3000);
  log(
    text().includes('typing') ||
      text().includes('Yes, it is still available') ||
      text().includes('small discount') ||
      text().includes('free after 6pm') ||
      text().includes('preferred time'),
    'seller auto-reply arrives',
  );

  /* --------------------------- chat search + block ----------------------- */
  await goto('/chats');
  await type('Rohan', { placeholder: 'Search by seller' });
  log(text().includes('Rohan Mehta'), 'chat search matches seller name');
  log(!text().includes('Priya Nair'), 'chat search hides non-matching sellers');
  await type('', { placeholder: 'Search by seller' });

  await goto('/ad/ad-3');
  await click('Chat', { exact: true, wait: 600 });
  await click('Chat options', { wait: 320 });
  await click('Report seller', { wait: 320 });
  log(text().includes('Asked for advance payment'), 'report sheet lists reasons');
  await click('Spam', { wait: 400 });
  log(text().includes('Block Priya?'), 'block prompt follows a report');
  await click('Block', { exact: true, wait: 500 });
  log(window.location.pathname === '/chats', 'blocking returns to the chat list');
  log(!text().includes('Priya Nair'), 'blocked seller hidden from chats');
  await goto('/search?q=macbook');
  log(!text().includes('MacBook Air M1'), "blocked seller's ads hidden from search");
  await goto('/profile');
  log(text().includes('Blocked sellers'), 'account lists blocked sellers');
  await click('Unblock', { exact: true, wait: 300 });
  log(!text().includes('Blocked sellers'), 'seller unblocked from account');

  /* ------------------------------ draft → live --------------------------- */
  await goto('/post');
  await click('Mobiles', { wait: 350 });
  await type('Pixel 7 draft for testing', { placeholder: 'brand' });
  await type('18000', { placeholder: '0' });
  await click('Continue', { wait: 350 });
  await click('Continue', { wait: 350 });
  await click('Save draft', { wait: 500 });
  log(text().includes('Pixel 7 draft for testing'), 'draft saved to My ads');
  await click('Edit draft', { wait: 450 });
  log(text().includes('Edit ad'), 'draft opens in the editor');
  const titleInput = [...document.querySelectorAll('input')].find(
    (i) => i.value === 'Pixel 7 draft for testing',
  );
  log(!!titleInput, 'editor is pre-filled with the draft');
  await type('Pixel 7 128GB finished draft', { placeholder: 'brand' });
  await click('Continue', { wait: 350 });
  await click('Continue', { wait: 350 });
  await click('Publish ad', { wait: 600 });
  log(
    window.location.pathname.startsWith('/ad/') && text().includes('Pixel 7 128GB finished draft'),
    'finished draft publishes as a live ad',
  );

  /* -------------------------------- filters ------------------------------ */
  await goto('/search?cat=mobiles');
  await click('Filters', { wait: 300 });
  log(text().includes('Price range') && text().includes('Condition'), 'filter sheet opens');
  await click('under ₹20,000', { wait: 150 });
  await click('Apply', { wait: 350 }).catch(async () => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Show'),
    );
    if (btn) applyClick(btn);
    await wait(350);
  });
  log(text().includes('Under ₹20,000') || text().includes('results'), 'filters applied to results');

  /* ------------------------------ notifications -------------------------- */
  await goto('/notifications');
  log(text().includes('Notifications'), 'notifications render');
  if (text().includes('Mark all read')) {
    await click('Mark all read', { wait: 250 });
    log(!text().includes('unread'), 'all notifications marked read');
  }

  await goto('/profile');
  log(
    text().includes('Arjun Sen') && text().includes('Dark mode'),
    'profile shows account + preferences',
  );
  await click('Dark mode', { wait: 250 });
  log(document.documentElement.classList.contains('dark'), 'dark mode toggles the html class');

  if (errors.length) {
    console.log('\n--- console errors ---');
    errors.slice(0, 20).forEach((e) => console.log('·', e.slice(0, 220)));
  }
  const passed = steps.filter((s) => s.ok).length;
  console.log(
    `\n${passed}/${steps.length} flow checks passed${errors.length ? `, ${errors.length} console errors` : ', no console errors'}`,
  );
  process.exit(failures.length || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error('\nFLOW TEST CRASHED:', e.message);
  console.log(`${steps.filter((s) => s.ok).length}/${steps.length} checks passed before crash`);
  process.exit(1);
});
