// Zenter Chat — 1:1 text chat module (V1)
// Mounted inside the dashboard Chats tab or standalone chat.html.
// Text-only. No media, no typing indicators, no read receipts.

import {
  getMyConversations, getMessages, sendMessage,
  subscribeToMessages, canStartChat,
  requestContactExchange, respondContactExchange,
  getContactExchangeStatus, trackEvent, from, query,
} from './supabase.js';

// ─── State ───────────────────────────────────────────────────────────────────

let myUserId = null;
let conversations = [];       // { id, connection_id, user_a, user_b, updated_at, otherUser }
let activeConvId = null;       // currently open conversation
let messages = [];             // messages for the active conversation
let realtimeChannel = null;    // Supabase realtime subscription
let lastReadMap = {};          // { convId: ISO timestamp } — persisted to sessionStorage
let allUsersMap = new Map();   // userId → { full_name, phone, ... } — injected by caller
let onUnreadChange = null;     // callback(totalUnread) — wired by dashboard

const STORAGE_KEY_BASE = 'hm.chat.lastRead';
let STORAGE_KEY = STORAGE_KEY_BASE; // updated to per-user in mountChat

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Mount the chat UI into a container element.
 * @param {HTMLElement} container — the DOM element to render into
 * @param {string} userId — current user's UUID
 * @param {Map} usersMap — all known users keyed by id (from dashboard)
 * @param {Function} [unreadCb] — called with total unread count
 */
export async function mountChat(container, userId, usersMap, unreadCb) {
  myUserId = userId;
  allUsersMap = usersMap || new Map();
  onUnreadChange = unreadCb || null;

  // Per-user storage key — prevents read state leaking across accounts on same device
  STORAGE_KEY = `${STORAGE_KEY_BASE}.${userId}`;

  // Use localStorage (survives logout/login) instead of sessionStorage
  try { lastReadMap = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { lastReadMap = {}; }

  container.innerHTML = `
    <div class="hm-chat-layout" id="hm-chat-layout">
      <div class="hm-chat-layout__sidebar" id="hm-chat-sidebar">
        <h3 style="font-size:var(--hm-text-base);font-weight:600;margin:0 0 var(--hm-space-3);">Chats</h3>
        <div id="hm-chat-list" class="hm-chat-list">
          <div style="text-align:center;padding:var(--hm-space-6) 0;">
            <div class="hm-loader__spinner" style="margin:0 auto;"></div>
          </div>
        </div>
      </div>
      <div class="hm-chat-layout__main" id="hm-chat-main">
        <div class="hm-chat-empty" id="hm-chat-empty">
          <div class="hm-chat-empty__icon">💬</div>
          <p class="hm-chat-empty__title">Your chats</p>
          <p class="hm-chat-empty__sub">Accept a connection request to start chatting. Select a conversation from the left.</p>
        </div>
      </div>
    </div>`;

  await loadConversations();
}

// ─── Load conversations ──────────────────────────────────────────────────────

async function loadConversations() {
  const { data, error } = await getMyConversations(myUserId);
  if (error) {
    document.getElementById('hm-chat-list').innerHTML =
      '<p class="hm-text-muted" style="text-align:center;padding:var(--hm-space-4);">Could not load chats.</p>';
    return;
  }

  // Collect other user IDs and fetch any missing from DB
  const convList = (data || []).map(conv => {
    const otherId = conv.user_a === myUserId ? conv.user_b : conv.user_a;
    return { ...conv, otherId };
  });

  const missingIds = convList
    .filter(c => !allUsersMap.has(c.otherId))
    .map(c => c.otherId);

  if (missingIds.length) {
    const { data: users } = await query(
      from('users')
        .select('id, full_name, phone, gender')
        .in('id', missingIds)
    );
    (users || []).forEach(u => allUsersMap.set(u.id, u));
  }

  conversations = convList.map(conv => ({
    ...conv,
    otherUser: allUsersMap.get(conv.otherId) || { full_name: 'User', id: conv.otherId },
  }));

  // First-time seeding: if user has no lastRead history, mark all existing
  // conversations as read up to their current updated_at. This prevents every
  // chat from appearing "unread" the first time the user logs in on this device.
  let mapChanged = false;
  conversations.forEach(c => {
    if (!lastReadMap[c.id]) {
      lastReadMap[c.id] = c.updated_at;
      mapChanged = true;
    }
  });
  if (mapChanged) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lastReadMap)); } catch {}
  }

  renderChatList();
  updateTotalUnread();
}

// ─── Render chat list ────────────────────────────────────────────────────────

function renderChatList() {
  const listEl = document.getElementById('hm-chat-list');
  if (!conversations.length) {
    listEl.innerHTML = `
      <div class="hm-chat-empty" style="padding:var(--hm-space-6) 0;">
        <div class="hm-chat-empty__icon">🤝</div>
        <p class="hm-chat-empty__sub">No chats yet. Accept a connection to start chatting!</p>
      </div>`;
    return;
  }

  listEl.innerHTML = conversations.map(conv => {
    const initials = avatarInitials(conv.otherUser.full_name);
    const color = avatarColor(conv.otherUser.full_name);
    const isActive = conv.id === activeConvId;
    const timeStr = formatRelativeTime(conv.updated_at);
    const lastRead = lastReadMap[conv.id];
    const isUnread = !isActive && (!lastRead || new Date(conv.updated_at) > new Date(lastRead));

    return `
      <div class="hm-chat-item ${isActive ? 'is-active' : ''} ${isUnread ? 'is-unread' : ''}"
           data-conv-id="${esc(conv.id)}" role="button" tabindex="0">
        <div class="hm-avatar hm-avatar--sm" style="background:${color};color:#fff;">${initials}</div>
        <div class="hm-chat-item__info">
          <p class="hm-chat-item__name">${esc(conv.otherUser.full_name)}${isUnread ? '<span class="hm-chat-unread-dot"></span>' : ''}</p>
          <p class="hm-chat-item__preview" id="hm-chat-preview-${conv.id}"></p>
        </div>
        <span class="hm-chat-item__time">${timeStr}</span>
      </div>`;
  }).join('');

  // Click handler
  listEl.querySelectorAll('.hm-chat-item').forEach(item => {
    item.addEventListener('click', () => openChat(item.dataset.convId));
  });
}

// ─── Open a chat ─────────────────────────────────────────────────────────────

async function openChat(convId) {
  if (activeConvId === convId) return;

  // Unsubscribe from previous
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }

  activeConvId = convId;
  const conv = conversations.find(c => c.id === convId);
  if (!conv) return;

  // Mark as active in the layout (for mobile)
  document.getElementById('hm-chat-layout')?.classList.add('has-active-chat');

  // Update sidebar active state
  document.querySelectorAll('.hm-chat-item').forEach(el => {
    el.classList.toggle('is-active', el.dataset.convId === convId);
  });

  // Render chat window
  const mainEl = document.getElementById('hm-chat-main');
  const initials = avatarInitials(conv.otherUser.full_name);
  const color = avatarColor(conv.otherUser.full_name);

  mainEl.innerHTML = `
    <div class="hm-chat-window">
      <div class="hm-chat-header">
        <button class="hm-chat-header__back" id="hm-chat-back">← Back</button>
        <div class="hm-avatar hm-avatar--sm" style="background:${color};color:#fff;">${initials}</div>
        <span class="hm-chat-header__name">${esc(conv.otherUser.full_name)}</span>
        <button class="hm-btn hm-btn--soft hm-btn--sm hm-chat-header__exchange"
                id="hm-exchange-btn">📞 Request Contact</button>
        <button class="hm-btn hm-btn--ghost hm-btn--sm" id="hm-chat-block-btn"
                style="color:var(--hm-danger);font-size:12px;" data-user-id="${esc(conv.otherId)}">🚫 Block</button>
      </div>
      <div id="hm-exchange-banner" class="hm-exchange-banner" hidden></div>
      <div class="hm-chat-messages" id="hm-chat-messages">
        <div style="text-align:center;padding:var(--hm-space-6) 0;">
          <div class="hm-loader__spinner" style="margin:0 auto;"></div>
        </div>
      </div>
      <div class="hm-chat-composer">
        <textarea class="hm-chat-composer__input" id="hm-chat-input"
                  placeholder="Type a message…" rows="1" maxlength="2000"></textarea>
        <button class="hm-chat-composer__send" id="hm-chat-send" disabled>➤</button>
      </div>
    </div>`;

  // Wire back button (mobile)
  document.getElementById('hm-chat-back')?.addEventListener('click', closeChat);

  // Wire send
  const input = document.getElementById('hm-chat-input');
  const sendBtn = document.getElementById('hm-chat-send');

  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim();
    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', handleSend);

  // Wire exchange contact button
  document.getElementById('hm-exchange-btn')?.addEventListener('click', () => handleExchangeRequest(convId));

  // Wire block button — dispatches to dashboard.js block modal
  document.getElementById('hm-chat-block-btn')?.addEventListener('click', () => {
    const userId = conv.otherId;
    // Trigger the block modal via the same data-conn-action system
    const evt = new MouseEvent('click', { bubbles: true });
    const fakeBtn = document.createElement('button');
    fakeBtn.dataset.connAction = 'block';
    fakeBtn.dataset.userId = userId;
    document.body.appendChild(fakeBtn);
    fakeBtn.dispatchEvent(evt);
    fakeBtn.remove();
  });

  // Load messages
  await loadMessages(convId);

  // Load exchange status
  await loadExchangeStatus(convId);

  // Mark as read
  markAsRead(convId);

  // Subscribe to realtime
  realtimeChannel = subscribeToMessages(convId, (msg) => {
    appendMessage(msg);
    if (msg.sender_id !== myUserId) {
      markAsRead(convId);
    }
    // Refresh exchange status on system messages
    if (msg.message_type === 'system') {
      loadExchangeStatus(convId);
    }
  });

  // Analytics
  trackEvent('chat_opened', myUserId, { conversation_id: convId });
}

function closeChat() {
  activeConvId = null;
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
  document.getElementById('hm-chat-layout')?.classList.remove('has-active-chat');
  document.getElementById('hm-chat-main').innerHTML = `
    <div class="hm-chat-empty" id="hm-chat-empty">
      <div class="hm-chat-empty__icon">💬</div>
      <p class="hm-chat-empty__title">Your chats</p>
      <p class="hm-chat-empty__sub">Select a conversation from the left.</p>
    </div>`;
}

// ─── Messages ────────────────────────────────────────────────────────────────

async function loadMessages(convId) {
  const { data, error } = await getMessages(convId, 100);
  messages = data || [];

  const container = document.getElementById('hm-chat-messages');
  if (!container) return;

  if (error || !messages.length) {
    container.innerHTML = `
      <div class="hm-chat-empty">
        <p class="hm-chat-empty__sub">No messages yet. Say hello! 👋</p>
      </div>`;
    return;
  }

  container.innerHTML = messages.map(renderMessage).join('');
  scrollToBottom();
}

function renderMessage(msg) {
  const time = formatTime(msg.created_at);

  if (msg.message_type === 'system') {
    // For system messages, prepend the sender's name
    const sender = allUsersMap.get(msg.sender_id);
    const name = sender?.full_name || 'Someone';
    return `<div class="hm-msg hm-msg--system">
      <strong>${esc(name)}</strong> ${esc(msg.body)}
      <span class="hm-msg__time">${time}</span>
    </div>`;
  }

  const isMine = msg.sender_id === myUserId;
  const cls = isMine ? 'hm-msg--sent' : 'hm-msg--received';

  return `<div class="hm-msg ${cls}">
    ${esc(msg.body)}
    <span class="hm-msg__time">${time}</span>
  </div>`;
}

function appendMessage(msg) {
  const container = document.getElementById('hm-chat-messages');
  if (!container) return;

  // Remove empty state if present
  const empty = container.querySelector('.hm-chat-empty');
  if (empty) empty.remove();

  messages.push(msg);
  container.insertAdjacentHTML('beforeend', renderMessage(msg));
  scrollToBottom();

  // Update preview in sidebar
  const preview = document.getElementById(`hm-chat-preview-${msg.conversation_id}`);
  if (preview) {
    const text = msg.message_type === 'system' ? '📋 ' + msg.body : msg.body;
    preview.textContent = text.length > 40 ? text.slice(0, 40) + '…' : text;
  }

  // Move this conversation to top of the list
  const conv = conversations.find(c => c.id === msg.conversation_id);
  if (conv) {
    conv.updated_at = new Date().toISOString();
    // Sender's own messages should never show as unread
    if (msg.sender_id === myUserId || msg.conversation_id === activeConvId) {
      markAsRead(msg.conversation_id);
    }
    conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    renderChatList();
  }
}

async function handleSend() {
  const input = document.getElementById('hm-chat-input');
  const body = (input?.value || '').trim();
  if (!body || !activeConvId) return;

  const sendBtn = document.getElementById('hm-chat-send');
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  const { error } = await sendMessage(activeConvId, myUserId, body);
  if (error) {
    // Restore the message
    input.value = body;
    sendBtn.disabled = false;
    console.error('[chat] send error', error);
    return;
  }

  // Analytics
  trackEvent('message_sent', myUserId, { conversation_id: activeConvId });
}

// ─── Contact Exchange ────────────────────────────────────────────────────────

async function loadExchangeStatus(convId) {
  const { data: exchange } = await getContactExchangeStatus(convId);
  const banner = document.getElementById('hm-exchange-banner');
  const exchangeBtn = document.getElementById('hm-exchange-btn');
  if (!banner) return;

  if (!exchange) {
    banner.hidden = true;
    if (exchangeBtn) exchangeBtn.hidden = false;
    return;
  }

  if (exchange.status === 'accepted') {
    // Contact exchanged — show numbers
    if (exchangeBtn) exchangeBtn.hidden = true;
    const conv = conversations.find(c => c.id === convId);
    const otherPhone = conv?.otherUser?.phone || 'Hidden';
    banner.hidden = false;
    banner.innerHTML = `
      <span class="hm-exchange-banner__text">📞 Contact exchanged!</span>
      <strong>${formatPhone(otherPhone)}</strong>`;
    return;
  }

  if (exchange.status === 'pending') {
    if (exchangeBtn) exchangeBtn.hidden = true;
    banner.hidden = false;

    if (exchange.responder_id === myUserId) {
      // I need to respond
      const requester = allUsersMap.get(exchange.requester_id);
      banner.innerHTML = `
        <span class="hm-exchange-banner__text">${esc(requester?.full_name || 'Someone')} wants to share contact details.</span>
        <button class="hm-btn hm-btn--primary hm-btn--sm" data-exchange-action="accept" data-exchange-id="${exchange.id}">Accept</button>
        <button class="hm-btn hm-btn--ghost hm-btn--sm" data-exchange-action="decline" data-exchange-id="${exchange.id}">Decline</button>`;

      // Wire buttons
      banner.querySelectorAll('[data-exchange-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const accept = btn.dataset.exchangeAction === 'accept';
          btn.disabled = true;
          const { data, error } = await respondContactExchange(exchange.id, myUserId, accept);
          if (error) { console.error('[exchange] error', error); btn.disabled = false; return; }

          trackEvent(accept ? 'contact_exchange_accepted' : 'contact_exchange_declined', myUserId, { conversation_id: convId });
          await loadExchangeStatus(convId);
        });
      });
    } else {
      // I sent the request — waiting
      banner.innerHTML = `
        <span class="hm-exchange-banner__text">⏳ Waiting for them to accept your contact exchange request.</span>`;
    }
    return;
  }

  if (exchange.status === 'declined') {
    banner.hidden = true;
    if (exchangeBtn) exchangeBtn.hidden = false; // can retry
  }
}

async function handleExchangeRequest(convId) {
  const btn = document.getElementById('hm-exchange-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Requesting…'; }

  const { error } = await requestContactExchange(convId, myUserId);
  if (error) {
    console.error('[exchange] request error', error);
    if (btn) { btn.disabled = false; btn.textContent = '📞 Request Contact'; }
    return;
  }

  trackEvent('contact_exchange_requested', myUserId, { conversation_id: convId });
  await loadExchangeStatus(convId);
}

// ─── Unread tracking ─────────────────────────────────────────────────────────

function markAsRead(convId) {
  lastReadMap[convId] = new Date().toISOString();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lastReadMap)); } catch {}
  // Remove unread styling from this chat item without full re-render
  const item = document.querySelector(`.hm-chat-item[data-conv-id="${convId}"]`);
  if (item) {
    item.classList.remove('is-unread');
    const dot = item.querySelector('.hm-chat-unread-dot');
    if (dot) dot.remove();
  }
  updateTotalUnread();
}

async function updateTotalUnread() {
  // Simple approach: count conversations with updated_at > lastRead
  let unread = 0;
  for (const conv of conversations) {
    const lastRead = lastReadMap[conv.id];
    if (!lastRead || new Date(conv.updated_at) > new Date(lastRead)) {
      if (conv.id !== activeConvId) unread++;
    }
  }
  if (onUnreadChange) onUnreadChange(unread);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scrollToBottom() {
  const el = document.getElementById('hm-chat-messages');
  if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function avatarInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function avatarColor(name) {
  const COLORS = ['#FF6B35','#4F46E5','#10B981','#F59E0B','#8B5CF6','#06B6D4','#EF4444'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = Math.imul(31, h) + name.charCodeAt(i) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatPhone(phone) {
  if (!phone) return '—';
  return phone.replace(/(\+91)(\d{5})(\d{5})/, '$1 $2 $3');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Refresh conversations list (e.g. after accepting a new connection). */
export async function refreshConversations() {
  await loadConversations();
}

/** Open a specific user's chat by their user ID. Called from connections/modal deep links. */
export function openChatByUserId(userId) {
  if (!userId) return;
  const conv = conversations.find(c => c.otherId === userId);
  if (conv) {
    openChat(conv.id);
  } else {
    // Conversation may not be loaded yet — retry after a short delay
    setTimeout(async () => {
      await loadConversations();
      const conv2 = conversations.find(c => c.otherId === userId);
      if (conv2) openChat(conv2.id);
    }, 500);
  }
}

/** Get current unread count without mounting. */
export { updateTotalUnread };
