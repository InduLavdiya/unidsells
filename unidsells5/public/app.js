// ===== UnidSells v3 Shared Utilities =====
const API = '/api';

const Auth = {
  getUser: () => { try { return JSON.parse(localStorage.getItem('us_user') || 'null'); } catch { return null; } },
  setUser: (u) => localStorage.setItem('us_user', JSON.stringify(u)),
  logout: () => { localStorage.removeItem('us_user'); window.location.href = '/login.html'; },
  require: () => { const u = Auth.getUser(); if (!u) { window.location.href = '/login.html'; return null; } return u; },
  isAdmin: () => { const u = Auth.getUser(); return u && (u.email === 'admin@gmail.com' || u.role === 'admin'); }
};

async function apiFetch(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const headers = isForm ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(API + path, { headers, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(msg, type = 'info') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<span>' + (icons[type] || 'ℹ') + '</span> ' + msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

const Wishlist = {
  get: () => { try { return JSON.parse(localStorage.getItem('us_wl') || '[]'); } catch { return []; } },
  add: (id) => { const w = Wishlist.get(); if (!w.includes(id)) { w.push(id); localStorage.setItem('us_wl', JSON.stringify(w)); } },
  remove: (id) => { localStorage.setItem('us_wl', JSON.stringify(Wishlist.get().filter(x => x !== id))); },
  toggle: (id) => { if (Wishlist.has(id)) { Wishlist.remove(id); return false; } Wishlist.add(id); return true; },
  has: (id) => Wishlist.get().includes(id)
};

function fmt(p) { return '₹' + Number(p).toLocaleString('en-IN'); }

function timeAgo(date) {
  const d = Date.now() - new Date(date).getTime(), m = Math.floor(d / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const dy = Math.floor(h / 24);
  if (dy < 30) return dy + 'd ago';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function initials(name = '') { return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'; }
function avatarColor(name = '') {
  return ['#C8973A','#6366F1','#1E7B4B','#C0392B','#8B5CF6','#0891B2','#D97706'][(name.charCodeAt(0)||0) % 7];
}
function avatarEl(user, cls = '') {
  if (user?.avatar) {
    return `<img src="${user.avatar}" class="avatar ${cls}" alt="${user.name}" onerror="this.outerHTML='<div class=\\'avatar ${cls}\\' style=\\'background:${avatarColor(user.name)}\\'>${initials(user.name)}</div>'">`;
  }
  return `<div class="avatar ${cls}" style="background:${avatarColor(user?.name||'')}">${initials(user?.name||'')}</div>`;
}

async function updateBadge() {
  const user = Auth.getUser();
  if (!user) return;
  try {
    const d = await apiFetch('/chats/unread/' + user._id);
    document.querySelectorAll('#chat-badge').forEach(b => {
      b.textContent = d.unreadCount;
      b.classList.toggle('show', d.unreadCount > 0);
    });
  } catch {}
}

function renderBottomNav(active) {
  const el = document.getElementById('bottom-nav');
  if (!el) return;
  el.innerHTML = `<nav class="bottom-nav">
    <div class="nav-item ${active==='home'?'active':''}" onclick="location.href='/'"><span class="ni">🏠</span><span>Home</span></div>
    <div class="nav-item ${active==='chats'?'active':''}" onclick="location.href='/chat-list.html'" style="position:relative">
      <span class="ni">💬</span><span>Chats</span><span class="badge" id="chat-badge"></span>
    </div>
    <div class="nav-item sell-fab" onclick="location.href='/sell.html'"><div class="fab">＋</div></div>
    <div class="nav-item ${active==='myads'?'active':''}" onclick="location.href='/myads.html'"><span class="ni">📦</span><span>My Ads</span></div>
    <div class="nav-item ${active==='account'?'active':''}" onclick="location.href='/account.html'"><span class="ni">👤</span><span>Account</span></div>
  </nav>`;
  updateBadge();
}

function renderProductCard(l, wishlist = []) {
  const img = l.images?.length ? l.images[0] : 'https://placehold.co/400x300/F7F5F0/C8973A?text=No+Image';
  const inWl = wishlist.includes(l._id);
  const overlay = l.status === 'sold'
    ? '<div class="sold-overlay"><div class="sold-stamp">SOLD</div></div>'
    : l.status === 'flagged'
    ? '<div class="flagged-overlay"><div class="sold-stamp" style="border-color:#fff;color:#fff">FLAGGED</div></div>'
    : '';
  return `<div class="product-card" onclick="location.href='/product.html?id=${l._id}'">
    <div class="img-wrap">
      <img src="${img}" alt="${l.title}" loading="lazy" onerror="this.src='https://placehold.co/400x300/F7F5F0/C8973A?text=No+Image'">
      ${overlay}
      <button class="wishlist-btn ${inWl?'active':''}" onclick="event.stopPropagation();wlToggle(event,'${l._id}',this)">${inWl?'❤️':'🤍'}</button>
    </div>
    <div class="card-body">
      <div class="price">${fmt(l.price)}</div>
      <div class="title">${l.title}</div>
      <div class="meta">📍 ${l.location} &nbsp;·&nbsp; ${timeAgo(l.createdAt)}</div>
    </div>
  </div>`;
}

function wlToggle(e, id, btn) {
  e.stopPropagation();
  const added = Wishlist.toggle(id);
  btn.textContent = added ? '❤️' : '🤍';
  btn.classList.toggle('active', added);
  showToast(added ? 'Added to wishlist ❤️' : 'Removed from wishlist', added ? 'success' : 'info');
}
