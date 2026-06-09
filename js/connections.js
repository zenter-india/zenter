// HallMate — Connections page (3-section relationship hub).
//
// Sections:
//   1. Received requests  — pending where receiver=me   (Accept / Reject)
//   2. Sent requests      — pending where sender=me     (Cancel)
//   3. Connected          — accepted connections        (Contact + Block)
//
// Refresh strategy:
//   The page listens for two window events fired by dashboard.js:
//     'hm:connections-changed' → any accept/decline/withdraw/connect →
//                                  full re-render of the 3 sections
//     'hm:user-blocked'        → drop a single card by data-conn-card-id
//
// Phone numbers are NEVER rendered for received/sent cards — only for
// accepted connections (status === 'accepted').

import { requireOnboarded }      from './auth.js';
import {
  getProfileByPhone,
  getMyConnections,
  getUsersByIds,
  getBlockedUserIds,
  getMyConversations,
  getContactExchangeStatus,
  requestContactExchange,
  trackEvent,
}                                from './supabase.js';
import { formatPhonePretty }     from './utils.js';

let _myUserId = null;
let _exchangeMap = new Map(); // conversationId → exchange status
let _convByOtherUser = new Map(); // otherUserId → conversationId

// ─── Bootstrap (standalone /connections.html path) ─────────────────────────

async function init() {
  const firebaseUser = await requireOnboarded(); // enforces profile completion
  if (!firebaseUser) return;
  const root = document.getElementById('hm-connections-root');
  if (!root) return;
  await runConnections(root, firebaseUser);
}

// ─── Public entry-point ────────────────────────────────────────────────────
// Called by dashboard.js when the Connections tab activates.

export async function runConnections(root, firebaseUser) {
  setLoading(root);
  wireBlockedListenerOnce(root);
  wireConnectionsChangedListenerOnce(root, firebaseUser);

  const { data: me, error: meErr } = await getProfileByPhone(firebaseUser.phoneNumber);
  if (meErr || !me) {
    renderError(root, 'Could not load your profile. Please sign in again.');
    return;
  }

  // Non-NEET UG users are redirected to maintenance (product focus is NEET UG).
  // Legacy users with null exam_type are treated as NEET UG.
  if (me.exam_type && me.exam_type !== 'NEET UG') {
    window.location.replace('/maintenance.html');
    return;
  }

  const [connsRes, blockedRes] = await Promise.all([
    getMyConnections(me.id),
    getBlockedUserIds(me.id),
  ]);
  if (connsRes.error) {
    renderError(root, connsRes.error.message || 'Could not load connections.');
    return;
  }

  // Filter out blocked users from all sections.
  const blockedSet = new Set((blockedRes.data || []).map(b => b.blocked_user_id));
  const allConns = (connsRes.data || []).filter(c => {
    const other = c.sender_id === me.id ? c.receiver_id : c.sender_id;
    return !blockedSet.has(other);
  });

  // Partition into the 3 sections.
  const received = allConns.filter(c => c.status === 'pending'  && c.receiver_id === me.id);
  const accepted = allConns.filter(c => c.status === 'accepted');
  // Sent requests section removed — users manage outgoing requests from Find Mates.

  _myUserId = me.id;

  // Only fetch profiles for accepted connections — received requests use a count link.
  const otherIds = [...new Set(
    accepted.map(c => c.sender_id === me.id ? c.receiver_id : c.sender_id)
  )];

  let byId = {};
  if (otherIds.length > 0) {
    const { data: users } = await getUsersByIds(otherIds);
    byId = Object.fromEntries((users || []).map(u => [u.id, u]));

    // Fetch any missing from seeded_users table
    const missingIds = otherIds.filter(id => !byId[id]);
    if (missingIds.length) {
      const { query: q, from: f } = await import('./supabase.js');
      const { data: seeded } = await q(
        f('seeded_users').select('id, full_name, gender, phone, exam_centre_district, exam_centre_state, exam_center, state, district, travel_mode, stay_plan').in('id', missingIds)
      );
      (seeded || []).forEach(u => { byId[u.id] = { ...u, __seeded: true }; });
    }
  }

  // Fetch conversations and exchange status for accepted connections
  _exchangeMap.clear();
  _convByOtherUser.clear();
  const { data: convs } = await getMyConversations(me.id);
  if (convs?.length) {
    for (const conv of convs) {
      const otherId = conv.user_a === me.id ? conv.user_b : conv.user_a;
      _convByOtherUser.set(otherId, conv.id);
      const { data: exStatus } = await getContactExchangeStatus(conv.id);
      if (exStatus) _exchangeMap.set(conv.id, exStatus);
    }
  }

  root.innerHTML = `
    ${renderRequestsLink(received.length)}
    ${renderSection({
      title: 'Connected', icon: '🔗',
      count: accepted.length,
      empty: 'You have not connected with anyone yet.',
      cards: accepted.map(c => {
        const otherId = c.sender_id === me.id ? c.receiver_id : c.sender_id;
        return connectedCard(byId[otherId], c);
      }),
    })}
  `;

  // Wire call-exchange buttons
  wireExchangeButtons(root);
}

// ─── Event wiring (idempotent) ─────────────────────────────────────────────

let blockListenerWired = false;
function wireBlockedListenerOnce(root) {
  if (blockListenerWired) return;
  blockListenerWired = true;
  window.addEventListener('hm:user-blocked', (e) => {
    const id = e.detail?.userId;
    if (!id) return;
    root.querySelectorAll(`[data-conn-card-id="${id}"]`).forEach(c => c.remove());
  });
}

let connsChangedListenerWired = false;
function wireConnectionsChangedListenerOnce(root, firebaseUser) {
  if (connsChangedListenerWired) return;
  connsChangedListenerWired = true;
  window.addEventListener('hm:connections-changed', () => {
    runConnections(root, firebaseUser);
  });
}

// ─── Render helpers ─────────────────────────────────────────────────────────

function setLoading(root) {
  root.innerHTML = `
    <div style="text-align:center;padding:var(--hm-space-7) var(--hm-space-5);">
      <div class="hm-loader__spinner" style="margin:0 auto;"></div>
      <p class="hm-text-muted" style="margin-top:var(--hm-space-3);">Loading connections…</p>
    </div>`;
}

function renderError(root, msg) {
  root.innerHTML = `
    <div class="hm-empty">
      <div class="hm-empty__icon" aria-hidden="true">⚠️</div>
      <h3>Something went wrong</h3>
      <p class="hm-text-muted">${esc(msg)}</p>
      <button type="button" class="hm-btn hm-btn--ghost" onclick="location.reload()">Try again</button>
    </div>`;
}

// Compact clickable banner — navigates to the Requests tab on dashboard.
// href="/dashboard.html#requests" works from both /connections.html standalone
// and from inside the dashboard tab (hashchange → activateTab('requests')).
function renderRequestsLink(count) {
  return `
    <a href="/dashboard.html#requests" class="hm-conn-requests-link"
       aria-label="View ${count} received connection request${count !== 1 ? 's' : ''}">
      <span class="hm-conn-requests-link__label">
        🤝 Pending Requests
        ${count > 0 ? `<span class="hm-nav-badge" style="margin-left:8px;">${count}</span>` : ''}
      </span>
      <span class="hm-conn-requests-link__arrow">→</span>
    </a>`;
}

function renderSection({ title, icon, count, empty, cards }) {
  return `
    <section class="hm-conn-section">
      <header class="hm-conn-section__header">
        <h2 class="hm-conn-section__title">
          <span aria-hidden="true">${icon}</span> ${esc(title)}
          <span class="hm-conn-section__count">${count}</span>
        </h2>
      </header>
      ${cards.length === 0
        ? `<p class="hm-conn-section__empty hm-text-muted">${esc(empty)}</p>`
        : `<div class="hm-grid-cards">${cards.filter(Boolean).join('')}</div>`}
    </section>`;
}

// ─── Card builders (unified with Find Mates layout) ──────────────────────

// Shared head — identical to mateCard() in dashboard.js
function cardHead(user) {
  const name       = user.full_name || 'Unknown';
  // gender colour from genderCls — no symbol needed
  const genderCls  = { Female: 'hm-badge--female', Male: 'hm-badge--male' }[user.gender] || '';
  return `
    <div class="hm-mate__head">
      <div class="hm-avatar hm-avatar--card"
           style="background:${avatarColor(name)};color:#fff;" aria-hidden="true">${esc(avatarInitials(name))}</div>
      <div class="hm-mate__head-info">
        <p class="hm-mate__name">${esc(name)}</p>
        <div class="hm-mate__badges">
          ${user.gender ? `<span class="hm-badge ${genderCls}">${esc(user.gender)}</span>` : ''}
          ${user.is_verified_aspirant ? `<span class="hm-badge hm-badge--verified-full" title="Admit card verified">✓ Verified</span>` : ''}
        </div>
      </div>
    </div>`;
}

// Shared body — route timeline identical to mateCard() in dashboard.js
function cardBody(user) {
  const homeDistrict = user.district || '';
  const homeState    = user.state    || '';
  const homeLocHtml  = homeDistrict && homeState
    ? `<strong>${esc(homeDistrict)}</strong><span class="hm-loc-state">, ${esc(homeState)}</span>`
    : `<strong>${esc(homeDistrict || homeState || '—')}</strong>`;
  const centre   = user.exam_center || '';
  const examDist = user.exam_centre_district || user.district || '';
  const examSt   = user.exam_centre_state    || user.state    || '';
  const examLoc  = [examDist, examSt].filter(Boolean).join(', ');
  const travelIcon  = user.travel_mode && TRAVEL_ICON[user.travel_mode];
  const travelLabel = user.travel_mode && TRAVEL_LABEL[user.travel_mode];
  const stayIcon    = user.stay_plan   && STAY_ICON[user.stay_plan];
  const stayLabel   = user.stay_plan   && STAY_LABEL[user.stay_plan];
  const hasBadges   = !!(travelLabel || stayLabel);
  return `
    <div class="hm-mate__body">
      <div class="hm-mate__route-wrap">
        <div class="hm-mate__route-track">
          <div class="hm-mate__icon-bubble">🏠</div>
          <div class="hm-mate__route-connector">
            <div class="hm-mate__route-dot hm-mate__route-dot--top"></div>
            <div class="hm-mate__route-dashes"></div>
            <div class="hm-mate__route-dot hm-mate__route-dot--bottom"></div>
          </div>
          <div class="hm-mate__icon-bubble">📋</div>
        </div>
        <div class="hm-mate__route-info">
          <p class="hm-mate__home-loc">${homeLocHtml}</p>
          <div class="hm-mate__exam-info">
            ${centre  ? `<p class="hm-mate__centre-name">${esc(centre)}</p>`    : ''}
            ${examLoc ? `<p class="hm-mate__centre-loc">📍 ${esc(examLoc)}</p>` : ''}
          </div>
        </div>
      </div>
      ${hasBadges ? `<div class="hm-mate__v-divider"></div>` : ''}
      ${hasBadges ? `
        <div class="hm-mate__badge-cards">
          ${travelLabel ? `<div class="hm-mate__badge-card"><span class="hm-mate__badge-icon">${esc(travelIcon)}</span><span class="hm-mate__badge-label">${esc(travelLabel)}</span></div>` : ''}
          ${stayLabel   ? `<div class="hm-mate__badge-card"><span class="hm-mate__badge-icon">${esc(stayIcon)}</span><span class="hm-mate__badge-label">${esc(stayLabel)}</span></div>` : ''}
        </div>` : ''}
    </div>`;
}

// 1. RECEIVED — Accept or Reject. No phone revealed.
function receivedCard(user, conn) {
  if (!user) return '';
  return `
    <article class="hm-card hm-mate" data-conn-card-id="${esc(user.id)}">
      ${cardHead(user)}
      ${cardBody(user)}
      <div class="hm-mate__footer">
        <span class="hm-mate__joined">Wants to connect</span>
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="hm-btn hm-btn--ghost hm-btn--sm"
            data-conn-action="decline" data-user-id="${esc(user.id)}" data-conn-id="${esc(conn.id)}">Reject</button>
          <button class="hm-btn hm-btn--primary hm-btn--sm"
            data-conn-action="accept"  data-user-id="${esc(user.id)}" data-conn-id="${esc(conn.id)}">Accept</button>
        </div>
      </div>
    </article>`;
}

// 2. CONNECTED — shows full phone if exchanged, masked otherwise.
function connectedCard(user, conn) {
  if (!user) return '';
  const name  = user.full_name || 'Unknown';
  const phone = user.phone || '';
  const convId = _convByOtherUser.get(user.id);
  const exchange = convId ? _exchangeMap.get(convId) : null;
  const isExchanged = exchange?.status === 'accepted';
  const isPending = exchange?.status === 'pending';

  let phoneSection;
  if (isExchanged) {
    // Full phone revealed — show Call + WhatsApp
    const phonePretty = formatPhonePretty(phone);
    const digits = phone.replace(/\D/g, '');
    const waHref = digits ? `https://wa.me/${digits}` : '';
    const telHref = phone ? `tel:${phone}` : '';
    phoneSection = `
      <p style="font-size:var(--hm-text-sm);color:var(--hm-text);font-weight:600;margin:0 0 var(--hm-space-2);">📱 ${esc(phonePretty)}</p>
      <div class="d-flex gap-2 flex-wrap">
        ${telHref ? `<a href="${esc(telHref)}" class="hm-btn hm-btn--primary hm-btn--sm">📞 Call</a>` : ''}
        <button class="hm-btn hm-btn--soft hm-btn--sm"
                data-conn-action="open-chat" data-user-id="${esc(user.id)}">Chat</button>
        <button class="hm-modal__block-btn hm-btn hm-btn--ghost hm-btn--sm" type="button"
                data-conn-action="block" data-user-id="${esc(user.id)}"
                aria-label="Block ${esc(name)}">🚫 Block</button>
      </div>`;
  } else {
    // Masked phone — Call triggers exchange request
    const maskedPhone = maskPhone(phone);
    const callLabel = isPending
      ? (exchange.requester_id === _myUserId ? '⏳ Exchange Pending' : '📞 Accept Exchange')
      : '📞 Call';
    const callDisabled = isPending && exchange.requester_id === _myUserId;
    phoneSection = `
      <p style="font-size:var(--hm-text-sm);color:var(--hm-text-muted);margin:0 0 var(--hm-space-2);">📱 ${esc(maskedPhone)}</p>
      <div class="d-flex gap-2 flex-wrap">
        <button class="hm-btn hm-btn--primary hm-btn--sm"
                data-conn-action="call-exchange" data-user-id="${esc(user.id)}"
                data-conv-id="${esc(convId || '')}"
                data-exchange-id="${esc(exchange?.id || '')}"
                ${callDisabled ? 'disabled' : ''}>${callLabel}</button>
        <button class="hm-btn hm-btn--soft hm-btn--sm"
                data-conn-action="open-chat" data-user-id="${esc(user.id)}">Chat</button>
        <button class="hm-modal__block-btn hm-btn hm-btn--ghost hm-btn--sm" type="button"
                data-conn-action="block" data-user-id="${esc(user.id)}"
                aria-label="Block ${esc(name)}">🚫 Block</button>
      </div>`;
  }

  return `
    <article class="hm-card hm-mate" data-conn-card-id="${esc(user.id)}">
      ${cardHead(user)}
      ${cardBody(user)}
      <div style="padding-top:var(--hm-space-3);border-top:1px solid var(--hm-border);">
        ${phoneSection}
      </div>
    </article>`;
}

function maskPhone(phone) {
  if (!phone) return '—';
  const s = String(phone);
  return `${s.startsWith('+91') ? '+91 ' : ''}XXXXXXX${s.slice(-3)}`;
}

// Wire 📞 Call buttons to send/accept exchange requests
function wireExchangeButtons(root) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-conn-action="call-exchange"]');
    if (!btn || btn.disabled) return;

    const userId = btn.dataset.userId;
    const convId = btn.dataset.convId;
    const exchangeId = btn.dataset.exchangeId;

    if (!convId) {
      // No conversation yet — shouldn't happen for accepted connections
      return;
    }

    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'Sending…';

    // Check if there's a pending exchange where WE are the responder → accept it
    const exchange = convId ? _exchangeMap.get(convId) : null;
    if (exchange?.status === 'pending' && exchange.responder_id === _myUserId) {
      const { respondContactExchange } = await import('./supabase.js');
      const { data, error } = await respondContactExchange(exchange.id, _myUserId, true);
      if (error) {
        btn.textContent = origText;
        btn.disabled = false;
        return;
      }
      trackEvent('contact_exchange_accepted', _myUserId, { conversation_id: convId, source: 'connections' });
      // Trigger re-render
      window.dispatchEvent(new CustomEvent('hm:connections-changed'));
      return;
    }

    // Otherwise send a new exchange request
    const { error } = await requestContactExchange(convId, _myUserId);
    if (error) {
      btn.textContent = origText;
      btn.disabled = false;
      // If already pending or already exchanged, show appropriate message
      if (error.message?.includes('already pending')) {
        btn.textContent = '⏳ Exchange Pending';
      } else if (error.message?.includes('already been exchanged')) {
        window.dispatchEvent(new CustomEvent('hm:connections-changed'));
      }
      return;
    }

    trackEvent('contact_exchange_requested', _myUserId, { conversation_id: convId, source: 'connections' });
    btn.textContent = '⏳ Exchange Pending';
    // Update local state
    _exchangeMap.set(convId, { status: 'pending', requester_id: _myUserId });
  });
}

// ─── Small helpers ─────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#D97706',
  '#DC2626', '#DB2777', '#0891B2',
];
function avatarColor(name) {
  let h = 0;
  for (const ch of (name || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function avatarInitials(name) {
  const safe = (name || '').trim();
  if (!safe) return '?';
  return safe.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Split icon/label maps — match dashboard.js exactly
const TRAVEL_ICON = {
  'By train':   '🚂', 'By flight':  '✈️', 'By bus': '🚌',
  'Self-drive': '🚗', 'Shared Cab': '🚕', 'Other':  '🚐',
};
const TRAVEL_LABEL = {
  'By train':   'Train',  'By flight':  'Flight', 'By bus': 'Bus',
  'Self-drive': 'Self Drive', 'Shared Cab': 'Shared Cab', 'Other': 'Other',
};
const STAY_ICON = {
  'Need accommodation':     '🏨', 'Have accommodation': '🏠',
  'Looking for room share': '🛏️', 'Other':              '🏡',
};
const STAY_LABEL = {
  'Need accommodation':     'Needs stay', 'Have accommodation': 'Has stay',
  'Looking for room share': 'Room share', 'Other':              'Yet to Decide',
};

function esc(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

document.addEventListener('DOMContentLoaded', init);
