// HallMate — DOM helpers, shared component loader, toast + loader primitives.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(el, event, handler, options) {
  if (!el) return noop;
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

const noop = () => {};

// Fetches an HTML partial and injects it into every element matching `selector`.
// Used by pages to mount the shared navbar + footer.
export async function mountPartial(selector, url) {
  const targets = $$(selector);
  if (targets.length === 0) return;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const html = await res.text();
    targets.forEach((node) => { node.innerHTML = html; });
  } catch (err) {
    console.error('[ui] mountPartial failed', err);
  }
}

// Loads the navbar + bottom nav in parallel into their mount points.
// Wires all navbar interactivity AFTER the HTML is injected — inline <script>
// tags inside innerHTML are never executed by the browser.
export async function mountChrome() {
  await Promise.all([
    mountPartial('[data-include="navbar"]', '/components/navbar.html'),
    mountPartial('[data-include="bottom-nav"]', '/components/bottom-nav.html'),
  ]);
  wireNavbarToggle();
  wireAvatarDropdown();
  wireBottomNav();
}

// Highlights the active bottom-tab based on the current page + hash, and
// keeps it in sync as the dashboard's in-page tabs change via #hash.
const BOTTOMNAV_PAGES = new Set(['/dashboard.html']);

export function wireBottomNav() {
  const nav = document.getElementById('hm-bottomnav');
  if (!nav) return;

  const update = () => {
    const path = location.pathname;
    const hash = location.hash.replace('#', '');

    let active = null;
    if (path === '/profile.html') active = 'profile';
    else if (path === '/connections.html') active = 'connections';
    else if (path === '/dashboard.html') {
      if (hash === 'connections') active = 'connections';
      else if (hash === 'requests') active = 'requests';
      else if (hash.startsWith('chats')) active = 'chats';
      else active = 'home';
    }

    $$('.hm-bottomnav__item', nav).forEach((el) => {
      el.classList.toggle('is-active', el.dataset.bottomnav === active);
    });
  };

  update();
  if (BOTTOMNAV_PAGES.has(location.pathname)) {
    window.addEventListener('hashchange', update);
  }
}

// Hamburger / mobile-drawer wiring. Idempotent — safe to call multiple times
// (e.g. if the navbar is ever re-mounted) because handlers are tagged via a
// data attribute and removed before re-attachment.
const MOBILE_BREAKPOINT = '(max-width: 991.98px)';

export function wireNavbarToggle() {
  const nav    = document.getElementById('hm-navbar');
  const toggle = document.getElementById('hm-nav-toggle');
  if (!nav || !toggle) return;

  // Guard against duplicate wiring.
  if (nav.dataset.hmNavWired === '1') return;
  nav.dataset.hmNavWired = '1';

  // ── Backdrop ──────────────────────────────────────────────────────────────
  // Created on <body> so its own position:fixed is always viewport-relative.
  // The navbar's backdrop-filter is now on a ::before pseudo-element (see
  // components.css) so the navbar itself no longer creates a containing block
  // for fixed descendants — #hm-nav-links stays inside the navbar and sizes
  // correctly against the viewport.
  let backdrop = document.getElementById('hm-drawer-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id        = 'hm-drawer-backdrop';
    backdrop.className = 'hm-drawer-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
  }

  // ── Open / close helpers ──────────────────────────────────────────────────
  const closeMenu = () => {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
  };

  const openMenu = () => {
    nav.classList.add('is-open');
    backdrop.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
  };

  // ── Hamburger toggle ──────────────────────────────────────────────────────
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (nav.classList.contains('is-open')) closeMenu();
    else openMenu();
  });

  // ── Close button inside drawer ────────────────────────────────────────────
  const closeBtn = document.getElementById('hm-drawer-close');
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  // ── Clicking a nav link / drawer action auto-closes on mobile ─────────────
  nav.addEventListener('click', (e) => {
    const link = e.target.closest(
      '.hm-nav-links a, .hm-nav-links__action, .hm-nav-actions a, .hm-nav-actions button'
    );
    if (!link) return;
    if (window.matchMedia(MOBILE_BREAKPOINT).matches) closeMenu();
  });

  // ── Backdrop click closes the drawer ─────────────────────────────────────
  backdrop.addEventListener('click', closeMenu);

  // ── Click outside the navbar closes the menu ──────────────────────────────
  document.addEventListener('click', (e) => {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(e.target))  return;
    if (e.target === backdrop)   return;
    closeMenu();
  });

  // ── Escape key ───────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!nav.classList.contains('is-open')) return;
    closeMenu();
    toggle.focus();
  });

  // ── Viewport resize past breakpoint — clean up open state ────────────────
  const mql = window.matchMedia(MOBILE_BREAKPOINT);
  const onBreakpointChange = (ev) => { if (!ev.matches) closeMenu(); };
  if (mql.addEventListener) mql.addEventListener('change', onBreakpointChange);
  else if (mql.addListener) mql.addListener(onBreakpointChange); // legacy Safari
}

// Account drawer wiring — idempotent, guarded by data attribute.
// Uses a CSS class (is-open) instead of the hidden attr so enter/exit
// transitions run correctly.
export function wireAvatarDropdown() {
  const btn      = document.getElementById('hm-avatar-btn');
  const drawer   = document.getElementById('hm-account-drawer');
  const backdrop = document.getElementById('hm-account-backdrop');
  const closeBtn = document.getElementById('hm-account-drawer-close');
  if (!btn || !drawer) return;
  if (btn.dataset.hmDropdownWired === '1') return;
  btn.dataset.hmDropdownWired = '1';

  const year = document.getElementById('hm-year');
  if (year) year.textContent = new Date().getFullYear();

  const open  = () => {
    drawer.classList.add('is-open');
    backdrop?.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    drawer.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  const toggle = () => drawer.classList.contains('is-open') ? close() : open();

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);

  // Auto-close when a link/action inside the drawer is activated.
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) close();
  });

  // Close on Escape, return focus to trigger button.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !drawer.classList.contains('is-open')) return;
    close();
    btn.focus();
  });
}

// --- Toast --------------------------------------------------------------------
let toastRoot;
function ensureToastRoot() {
  if (toastRoot) return toastRoot;
  toastRoot = document.createElement('div');
  toastRoot.className = 'hm-toast-container';
  toastRoot.setAttribute('aria-live', 'polite');
  toastRoot.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toastRoot);
  return toastRoot;
}

export function toast(message, { variant = 'info', duration = 3200, html = false } = {}) {
  const root = ensureToastRoot();
  const el = document.createElement('div');
  el.className = `hm-toast hm-toast--${variant}`;
  if (html) el.innerHTML = message;
  else el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 220);
  }, duration);
}

// --- Full-screen loader -------------------------------------------------------
let loaderEl;
export function showLoader(label = 'Loading…') {
  if (loaderEl) { loaderEl.querySelector('.hm-loader__label').textContent = label; return; }
  loaderEl = document.createElement('div');
  loaderEl.className = 'hm-loader-overlay';
  loaderEl.innerHTML = `
    <div class="hm-loader" role="status" aria-live="polite">
      <div class="hm-loader__spinner" aria-hidden="true"></div>
      <div class="hm-loader__label">${label}</div>
    </div>`;
  document.body.appendChild(loaderEl);
}
export function hideLoader() {
  if (!loaderEl) return;
  loaderEl.remove();
  loaderEl = null;
}

// Toggle button busy state — disables and swaps in a spinner without losing label.
export function setButtonBusy(btn, busy, busyLabel) {
  if (!btn) return;
  if (busy) {
    btn.dataset.originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${busyLabel ?? 'Please wait…'}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalLabel) {
      btn.innerHTML = btn.dataset.originalLabel;
      delete btn.dataset.originalLabel;
    }
  }
}

// Highlights the active navbar link based on `data-route` attributes.
export function highlightActiveNav(route) {
  $$('[data-route]').forEach((el) => {
    el.classList.toggle('active', el.dataset.route === route);
  });
}
