/* ============================================================
   FighTea — Customer Notification System  (notifications.js)
   
   Strategy:
   1. Try Server-Sent Events (SSE) first — ideal for VPS/Railway
   2. Auto-fall back to polling every 8s — works on Vercel serverless
      where SSE connections are cut at 10s timeout
   
   Triggered: when admin/staff marks an order "Ready"
   Customer sees: full-screen popup + chime + page title flash
   ============================================================ */
'use strict';

/* ── CONFIG ──────────────────────────────────────────────── */
const NOTIF_CONFIG = {
  pollInterval:      8000,      // polling fallback interval in ms
  sseTimeout:        12000,     // if SSE doesn't confirm within 12s, switch to polling
  reconnectDelay:    4000,      // base delay before SSE reconnect
  maxReconnects:     5,         // max SSE reconnect attempts before falling back
  autoDismiss:       60000,     // auto-dismiss popup after 60s
};

/* ── STATE ───────────────────────────────────────────────── */
const Notif = {
  mode:           null,       // 'sse' | 'poll' | null
  eventSource:    null,
  pollTimer:      null,
  sseTimer:       null,       // SSE confirm timeout
  reconnectTimer: null,
  reconnectCount: 0,
  lastChecked:    new Date().toISOString(),   // ISO timestamp; poll sends this as ?since=
  knownReadyOrders: new Set(),               // order_numbers already shown to this session
};

/* ── PUBLIC: START ───────────────────────────────────────── */
/**
 * Start the notification system after a user logs in.
 * Automatically chooses SSE or polling.
 */
function startNotifications() {
  if (!isLoggedIn()) return;
  if (Notif.mode) return;   // already running

  // Admin / staff don't need order-ready popups but still benefit from queue updates
  _trySSE();
}

/* ── PUBLIC: STOP ────────────────────────────────────────── */
function stopNotifications() {
  _clearSSE();
  _clearPoll();
  Notif.mode = null;
  Notif.reconnectCount = 0;
  Notif.knownReadyOrders.clear();
}

/* ══════════════════════════════════════════════════════════
   SSE TRANSPORT
   ════════════════════════════════════════════════════════ */
function _trySSE() {
  if (!window.EventSource) { _startPolling(); return; }

  const token = localStorage.getItem('fightea_token') ||
                (App.currentUser ? btoa(App.currentUser.id + ':' + Date.now()) : null);
  if (!token) { _startPolling(); return; }

  const base = window.FIGHTEA_API_BASE || 'http://localhost:4000/api';
  const url  = `${base}/notifications/stream?token=${encodeURIComponent(token)}`;

  try {
    const es = new EventSource(url, { withCredentials: false });
    Notif.eventSource = es;

    // If SSE doesn't confirm within timeout, fall back to polling
    Notif.sseTimer = setTimeout(() => {
      console.log('⏱ SSE confirm timeout — switching to polling');
      _clearSSE();
      _startPolling();
    }, NOTIF_CONFIG.sseTimeout);

    es.addEventListener('connected', () => {
      clearTimeout(Notif.sseTimer);
      Notif.mode = 'sse';
      Notif.reconnectCount = 0;
      console.log('🔔 Notifications: SSE connected');
    });

    es.addEventListener('order_ready', (e) => {
      try { _handleOrderReady(JSON.parse(e.data)); } catch (_) {}
    });

    es.addEventListener('queue_updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (isAdmin() && App.currentView === 'admin') {
          if (typeof renderQueue === 'function') {
            const f = document.querySelector('.queue-filter.active')?.dataset.filter || 'active';
            renderQueue(f);
          }
        }
      } catch (_) {}
    });

    es.onerror = () => {
      clearTimeout(Notif.sseTimer);
      _clearSSE();

      if (Notif.reconnectCount < NOTIF_CONFIG.maxReconnects) {
        Notif.reconnectCount++;
        const delay = NOTIF_CONFIG.reconnectDelay * Notif.reconnectCount;
        console.log(`🔁 SSE error — reconnecting in ${delay / 1000}s (${Notif.reconnectCount}/${NOTIF_CONFIG.maxReconnects})`);
        Notif.reconnectTimer = setTimeout(() => {
          if (isLoggedIn()) _trySSE();
        }, delay);
      } else {
        console.log('📡 SSE unavailable — switching to polling fallback');
        _startPolling();
      }
    };
  } catch (err) {
    console.warn('SSE init failed:', err.message);
    _startPolling();
  }
}

function _clearSSE() {
  clearTimeout(Notif.sseTimer);
  clearTimeout(Notif.reconnectTimer);
  if (Notif.eventSource) {
    Notif.eventSource.close();
    Notif.eventSource = null;
  }
  if (Notif.mode === 'sse') Notif.mode = null;
}

/* ══════════════════════════════════════════════════════════
   POLLING FALLBACK
   Calls GET /api/notifications/poll?since=<ISO>
   Returns any order_ready events since last check.
   ════════════════════════════════════════════════════════ */
function _startPolling() {
  if (Notif.pollTimer) return;   // already polling
  Notif.mode = 'poll';
  console.log('📡 Notifications: polling every', NOTIF_CONFIG.pollInterval / 1000 + 's');
  _poll();  // immediate first check
  Notif.pollTimer = setInterval(_poll, NOTIF_CONFIG.pollInterval);
}

function _clearPoll() {
  if (Notif.pollTimer) { clearInterval(Notif.pollTimer); Notif.pollTimer = null; }
  if (Notif.mode === 'poll') Notif.mode = null;
}

async function _poll() {
  if (!isLoggedIn()) return;
  const token = localStorage.getItem('fightea_token');
  if (!token) return;

  try {
    const base = window.FIGHTEA_API_BASE || 'http://localhost:4000/api';
    const res  = await fetch(
      `${base}/notifications/poll?since=${encodeURIComponent(Notif.lastChecked)}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) return;

    const data = await res.json();
    Notif.lastChecked = new Date().toISOString();

    for (const event of (data.events || [])) {
      if (event.type === 'order_ready') _handleOrderReady(event.data);
      if (event.type === 'queue_updated' && isAdmin() && App.currentView === 'admin') {
        if (typeof renderQueue === 'function') {
          const f = document.querySelector('.queue-filter.active')?.dataset.filter || 'active';
          renderQueue(f);
        }
      }
    }
  } catch (_) {
    // Network error — silent, will retry on next interval
  }
}

/* ══════════════════════════════════════════════════════════
   EVENT HANDLER
   ════════════════════════════════════════════════════════ */
function _handleOrderReady(data) {
  // Deduplicate — don't show the same order twice in this session
  if (Notif.knownReadyOrders.has(data.order_number)) return;
  Notif.knownReadyOrders.add(data.order_number);

  // Only show popup to the customer who placed the order (not admin/staff)
  // Admin/staff still get the queue auto-refresh from queue_updated events
  if (!isAdmin()) {
    showOrderReadyPopup(data);
    _playChime();
    _flashTitle('✅ Your Order is Ready! — FighTea');
    _updateBell();
  }
}

/* ══════════════════════════════════════════════════════════
   ORDER READY POPUP
   ════════════════════════════════════════════════════════ */
function showOrderReadyPopup(data) {
  // Remove any existing popup
  dismissOrderReadyPopup(true);

  const isCash = data.payment === 'cash';
  const payLine = isCash
    ? 'Please come to the counter to pay and collect your order.'
    : 'Your payment is confirmed. Please come to the counter to collect.';

  const el = document.createElement('div');
  el.id   = 'order-ready-popup';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Your order is ready for pickup');

  el.innerHTML = `
    <div class="orpop-backdrop" aria-hidden="true" onclick="dismissOrderReadyPopup()"></div>
    <div class="orpop-card" role="document">
      <!-- Animated icon -->
      <div class="orpop-icon-wrap" aria-hidden="true">
        <div class="orpop-ripple orpop-ripple-1"></div>
        <div class="orpop-ripple orpop-ripple-2"></div>
        <div class="orpop-icon-circle">
          <span class="orpop-check">✓</span>
        </div>
      </div>

      <h2 class="orpop-title">Your Order is Ready!</h2>
      <p class="orpop-subtitle">Your order has been freshly prepared and<br>is waiting for you at the counter.</p>

      <div class="orpop-order-box">
        <p class="orpop-order-label">Order Number</p>
        <p class="orpop-order-num">${data.order_number}</p>
        <p class="orpop-order-name">For: <strong>${data.customer || 'You'}</strong></p>
      </div>

      <p class="orpop-pay-note">${payLine}</p>

      <button class="orpop-cta" onclick="dismissOrderReadyPopup()" autofocus>
        <span class="orpop-cta-icon">🧋</span> Got it, on my way!
      </button>

      <p class="orpop-hint">Tap anywhere outside or press <kbd>Esc</kbd> to dismiss</p>
    </div>`;

  document.body.appendChild(el);

  // Animate in on next frame
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('orpop-visible')));

  // Keyboard dismiss
  const keyHandler = (e) => { if (e.key === 'Escape') dismissOrderReadyPopup(); };
  el._keyHandler = keyHandler;
  document.addEventListener('keydown', keyHandler, { once: true });

  // Auto-dismiss
  el._timer = setTimeout(dismissOrderReadyPopup, NOTIF_CONFIG.autoDismiss);
}

function dismissOrderReadyPopup(immediate = false) {
  const el = document.getElementById('order-ready-popup');
  if (!el) return;
  clearTimeout(el._timer);
  if (el._keyHandler) document.removeEventListener('keydown', el._keyHandler);

  if (immediate) {
    el.remove();
  } else {
    el.classList.remove('orpop-visible');
    el.classList.add('orpop-hiding');
    setTimeout(() => el.remove(), 450);
  }
}

/* ══════════════════════════════════════════════════════════
   NOTIFICATION BELL BADGE
   ════════════════════════════════════════════════════════ */
let _bellCount = 0;

function _updateBell() {
  _bellCount++;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = _bellCount > 9 ? '9+' : _bellCount;
    badge.style.display = 'flex';
    badge.classList.add('notif-badge-pulse');
    setTimeout(() => badge.classList.remove('notif-badge-pulse'), 600);
  }
}

function clearNotificationBadge() {
  _bellCount = 0;
  const badge = document.getElementById('notif-badge');
  if (badge) badge.style.display = 'none';
}

/* ══════════════════════════════════════════════════════════
   CHIME — Web Audio API
   Pleasant two-note ding using pure JS (no audio file needed)
   ════════════════════════════════════════════════════════ */
function _playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const note = (freq, start, dur, vol) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    const t = ctx.currentTime;
    note(880,  t,        0.30, 0.4);   // A5  — initial ding
    note(1108, t + 0.22, 0.45, 0.28);  // C#6 — rising finish
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch (_) {
    // Web Audio blocked (e.g. autoplay policy) — silent fail
  }
}

/* ══════════════════════════════════════════════════════════
   PAGE TITLE FLASH
   Draws attention when the tab is in the background
   ════════════════════════════════════════════════════════ */
let _titleTimer     = null;
let _originalTitle  = document.title;

function _flashTitle(flashText, duration = 12000) {
  clearInterval(_titleTimer);
  let toggled = true;
  _titleTimer = setInterval(() => {
    document.title = toggled ? flashText : _originalTitle;
    toggled = !toggled;
  }, 1200);
  setTimeout(() => {
    clearInterval(_titleTimer);
    _titleTimer = null;
    document.title = _originalTitle;
  }, duration);
}

// Restore title when user focuses the tab
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && _titleTimer) {
    clearInterval(_titleTimer);
    _titleTimer = null;
    document.title = _originalTitle;
  }
});

/* ══════════════════════════════════════════════════════════
   COMPATIBILITY ALIASES (keep old code working if called)
   ════════════════════════════════════════════════════════ */
const connectNotifications    = startNotifications;
const disconnectNotifications = stopNotifications;
