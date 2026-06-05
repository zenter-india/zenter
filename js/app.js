// HallMate — Route-aware bootstrap entry point.
// Every page loads this single file. It mounts shared chrome, wires up nav state,
// and dispatches to a page-specific initializer based on the current route.

import { mountChrome, highlightActiveNav, $, $$, on, toast } from './ui.js';
import { whenReady, onAuthChange, getCurrentUser, logout, requireAuth } from './auth.js';
import { currentRoute } from './utils.js';
import { ROUTES, STORAGE_KEYS } from './config.js';

// Route -> initializer. Each page registers its concerns here.
// Phase 1: shells only. Logic lands in Phase 2.
const ROUTE_INITIALIZERS = {
  index: initLanding,
  login: initLogin,
  onboarding: initOnboarding,
  dashboard: initDashboard,
  connections: initConnections,
  profile: initProfile,
};

document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  const route = currentRoute();
  document.body.dataset.route = route;

  await mountChrome();
  highlightActiveNav(route);
  wireGlobalNav();
  wireBrandNavigation();
  wireBackButton(route);
  loadAnnouncementBar(route);

  // Reflect auth state into the navbar (login button <-> avatar/logout).
  onAuthChange(renderNavAuthState);

  const init = ROUTE_INITIALIZERS[route];
  if (init) {
    try { await init(); }
    catch (err) { console.error(`[app] init error on ${route}`, err); }
  }
}

// ─── Back button ─────────────────────────────────────────────────────────────
// Pages where ← Back is hidden (no meaningful "back" concept).
const NO_BACK_PAGES = ['login', 'onboarding', 'dashboard', 'index'];

function wireBackButton(route) {
  const btn = document.getElementById('hm-nav-back');
  if (!btn) return;
  if (!NO_BACK_PAGES.includes(route)) {
    btn.hidden = false;
  }
}

function wireGlobalNav() {
  // Logout buttons can appear anywhere — delegate from document.
  on(document, 'click', (e) => {
    const target = e.target.closest('[data-action="logout"]');
    if (!target) return;
    e.preventDefault();
    logout().catch((err) => console.error('[app] logout failed', err));
  });

  wireFeedbackModal();
}

// ─── Feedback modal ───────────────────────────────────────────────────────────

// Cached once per session when the feedback modal first opens.
// Avoids a Supabase call on every submit while still capturing user metadata.
let _feedbackUserCache = null;

function wireFeedbackModal() {
  const overlay  = document.getElementById('hm-feedback-overlay');
  const ta       = document.getElementById('hm-feedback-text');
  const errEl    = document.getElementById('hm-feedback-err');
  if (!overlay) return;

  const openFeedback = async () => {
    if (ta)    ta.value = '';
    if (errEl) errEl.hidden = true;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => ta?.focus(), 60);

    // Lazy-fetch user profile once per session for metadata enrichment.
    if (!_feedbackUserCache) {
      const user = getCurrentUser();
      if (user?.phoneNumber) {
        try {
          const { getProfileByPhone } = await import('./supabase.js');
          const { data } = await getProfileByPhone(user.phoneNumber);
          if (data) _feedbackUserCache = data; // { id, full_name, exam_type, … }
        } catch { /* non-fatal — metadata is optional */ }
      }
    }
  };

  const closeFeedback = () => {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  // Open on Feedback button click
  on(document, 'click', (e) => {
    if (e.target.closest('[data-action="feedback"]')) { e.preventDefault(); openFeedback(); }
  });

  // Close on Cancel button or backdrop click
  on(document, 'click', (e) => {
    if (e.target.id === 'hm-feedback-cancel' || e.target === overlay) closeFeedback();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeFeedback();
  });

  // Submit
  on(document, 'click', async (e) => {
    if (e.target.id !== 'hm-feedback-submit') return;

    const msg = (ta?.value || '').trim();
    if (!msg) {
      if (errEl) { errEl.textContent = 'Please enter your feedback.'; errEl.hidden = false; }
      return;
    }
    if (errEl) errEl.hidden = true;

    const btn = document.getElementById('hm-feedback-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      const { submitFeedback } = await import('./supabase.js');
      const { error } = await submitFeedback({
        user_id:          _feedbackUserCache?.id        || null,
        user_name:        _feedbackUserCache?.full_name || null,
        exam_type:        _feedbackUserCache?.exam_type || null,
        feedback_message: msg,
      });

      if (error) {
        if (errEl) { errEl.textContent = 'Could not submit. Please try again.'; errEl.hidden = false; }
      } else {
        closeFeedback();
        toast('Thank you for your feedback! 😊', { variant: 'success' });
      }
    } catch (err) {
      console.error('[feedback] submit error', err);
      if (errEl) { errEl.textContent = 'Something went wrong. Please try again.'; errEl.hidden = false; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
    }
  });
}

function renderNavAuthState(user) {
  // Toggle ALL data-auth elements — the navbar has auth items in multiple
  // locations (hm-nav-cta, hm-nav-actions, hm-nav-profile, nav-link <li>s).
  $$('[data-auth="logged-out"]').forEach((el) => { el.hidden = !!user; });
  $$('[data-auth="logged-in"]').forEach((el) => { el.hidden = !user; });

  // Auth-aware logo routing: covers EVERY .hm-brand on the page
  // (navbar + footer + any future surface). The click-time handler in
  // wireBrandNavigation() is the race-safe primary; this href update keeps
  // hover/middle-click/right-click behaviour correct for the right page.
  const targetHref = user ? ROUTES.dashboard : ROUTES.landing;
  $$('.hm-brand').forEach((el) => { el.href = targetHref; });

  if (user) {
    updateNavbarAvatar();

    // Hide the profile avatar/dropdown during onboarding.
    const navProfile = document.querySelector('.hm-nav-profile');
    if (navProfile) {
      const done = sessionStorage.getItem(STORAGE_KEYS.profileCompleted);
      if (done === 'false') navProfile.hidden = true;
    }

    // Show the Admin panel link only to admin users.
    // Role is cached in 'hm.user.role' by dashboard.js after fetching profile.
    const adminNavItem = document.getElementById('hm-admin-nav-item');
    if (adminNavItem) {
      try {
        const cachedRole = sessionStorage.getItem('hm.user.role');
        adminNavItem.hidden = cachedRole !== 'admin' && cachedRole !== 'superadmin';
      } catch { adminNavItem.hidden = true; }
    }
  }
}

// Single source of truth for logo/brand clicks. Re-checks auth state at click
// time so a click that lands BEFORE Firebase resolves never accidentally
// routes a logged-in user to the public landing page.
//
// Modifier-clicks (cmd/ctrl/shift, middle-click) are passed through unmodified
// so "open in new tab" still works — the href attribute is kept in sync by
// renderNavAuthState() for that case.
function wireBrandNavigation() {
  document.addEventListener('click', (e) => {
    const brand = e.target.closest('.hm-brand');
    if (!brand) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;

    e.preventDefault();
    const isAuthed = !!getCurrentUser() || !!sessionStorage.getItem(STORAGE_KEYS.authUser);
    window.location.href = isAuthed ? ROUTES.dashboard : ROUTES.landing;
  });
}

// Reads cached initials written by profile.js (STORAGE_KEYS.profile) so the
// avatar shows real initials on every page — no extra Supabase call needed.
function updateNavbarAvatar() {
  const el = document.getElementById('hm-navbar-avatar');
  if (!el) return;
  try {
    const cached = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.profile) || 'null');
    if (cached?.initials) { el.textContent = cached.initials; return; }
  } catch { /* ignore malformed cache */ }
  // Fallback: "Me" renders until the user visits their profile page.
  // el.textContent is already "Me" from the navbar HTML default.
}

// --- Page initializers (shells) ----------------------------------------------

async function initLanding() {
  // Public marketing page — no auth required. Hook ALL CTA buttons into login flow.
  // Using $$ (querySelectorAll) so both hero + bottom-section CTAs are wired.
  $$('[data-cta="primary"]').forEach((btn) => {
    on(btn, 'click', () => { window.location.href = ROUTES.login; });
  });
}

async function initLogin() {
  // Redirect-if-authed + auth gate are owned by login.js. No duplicate redirect
  // here — running it twice means two whenReady() awaits + two replace() calls.
}

async function initOnboarding() {
  const user = await requireAuth();
  if (!user) return;
  // Phase 2: multi-step wizard -> upsert into Supabase `profiles`.
}

async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;
  // Phase 2: load centre mates, filters, connection requests.
}

async function initConnections() {
  const user = await requireAuth();
  if (!user) return;
  // Phase 2: load accepted connections + pending requests.
}

async function initProfile() {
  const user = await requireAuth();
  if (!user) return;
  // Phase 2: load + edit profile, manage privacy + connections.
}

// ─── Announcement ticker bar ──────────────────────────────────────────────────
// Shown below the navbar on all pages EXCEPT profile and onboarding.
// Data comes from the announcements table, controlled via /admin.html → Settings.

async function loadAnnouncementBar(route) {
  // Skip on profile, onboarding — these are task-focused flows
  if (['profile', 'onboarding'].includes(route)) return;

  try {
    const { getActiveAnnouncements, getPlatformConfig } = await import('./supabase.js');

    // Check feature toggle (non-blocking — default to showing if config unavailable)
    const { data: configRows } = await getPlatformConfig();
    const toggles = (configRows || []).find(r => r.key === 'feature_toggles')?.value;
    if (toggles?.announcements === false) return;

    const { data: announcements } = await getActiveAnnouncements();
    if (!announcements?.length) return;

    // Build the ticker text — all active announcements joined with a separator
    const text = announcements.map(a => a.message).join('   ·   ');
    const safe = text.replace(/[&<>"']/g,
      c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

    const bar = document.createElement('div');
    bar.id        = 'hm-announcement-bar';
    bar.className = 'hm-announcement-bar';
    bar.setAttribute('role', 'marquee');
    bar.setAttribute('aria-label', 'Announcements');
    // Each span includes a trailing separator so the loop join is seamless —
    // the gap between repetitions is just the "   ·   " characters, not padding.
    const unit = `📢 ${safe}   ·   `;
    bar.innerHTML = `
      <div class="hm-announcement-bar__ticker">
        <span class="hm-announcement-bar__text">${unit}</span>
        <span class="hm-announcement-bar__text" aria-hidden="true">${unit}</span>
      </div>`;

    // Insert immediately after the navbar
    const navbar = document.getElementById('hm-navbar');
    if (navbar?.parentNode) {
      navbar.parentNode.insertBefore(bar, navbar.nextSibling);
    }
  } catch (err) {
    console.warn('[announcements] could not load', err);
  }
}

// Surface a one-time ready signal for debugging in DevTools.
whenReady().then((user) => {
  window.__hm = { ready: true, user };
});
