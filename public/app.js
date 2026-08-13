// State Management
let appState = {
  hotel: null,
  session: null,
  token: localStorage.getItem('guest_token') || null,
  menuItems: [],
  cart: {}, // { menuItemId: { item, qty } }
  activeOrder: null,
  selectedCategory: 'all',
  geoCoords: null,
  geoVerified: false,
  socket: null
};

// DOM Elements
const screens = {
  checkin: document.getElementById('screen-checkin'),
  menu: document.getElementById('screen-menu'),
  order: document.getElementById('screen-order')
};

const el = {
  hotelName: document.getElementById('hotel-name'),
  hotelAddress: document.getElementById('hotel-address'),
  guestRoomBadge: document.getElementById('guest-room-badge'),
  badgeRoomNum: document.getElementById('badge-room-num'),
  qrInput: document.getElementById('input-qr-token'),
  guestNameInput: document.getElementById('input-guest-name'),
  roomNumInput: document.getElementById('input-room-number'),
  geoDot: document.getElementById('geo-dot'),
  geoText: document.getElementById('geo-text'),
  btnVerifyGeo: document.getElementById('btn-verify-geo'),
  checkinForm: document.getElementById('checkin-form'),
  categoriesContainer: document.getElementById('categories-container'),
  menuGrid: document.getElementById('menu-grid'),
  menuSearch: document.getElementById('menu-search'),
  cartFloatingBar: document.getElementById('cart-floating-bar'),
  cartCountBadge: document.getElementById('cart-count-badge'),
  cartTotalPrice: document.getElementById('cart-total-price'),
  cartModal: document.getElementById('cart-modal'),
  cartItemsContainer: document.getElementById('cart-items-container'),
  modalCartTotal: document.getElementById('modal-cart-total'),
  btnCloseCart: document.getElementById('btn-close-cart'),
  btnPlaceOrder: document.getElementById('btn-place-order'),
  orderIdDisp: document.getElementById('order-id-disp'),
  orderStatusBadge: document.getElementById('order-status-badge'),
  orderStatusTitle: document.getElementById('order-status-title'),
  orderStatusDesc: document.getElementById('order-status-desc'),
  orderItemsList: document.getElementById('order-items-list'),
  orderTotalDisp: document.getElementById('order-total-disp'),
  btnPayNow: document.getElementById('btn-pay-now'),
  btnNewOrder: document.getElementById('btn-new-order'),
  toast: document.getElementById('toast')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Check URL params for QR
  const urlParams = new URLSearchParams(window.location.search);
  const qrParam = urlParams.get('qr');
  if (qrParam) {
    el.qrInput.value = qrParam;
  }

  // Socket connection
  if (typeof io !== 'undefined') {
    appState.socket = io({
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });
    appState.socket.on('connect_error', (err) => console.warn('public app socket connect_error', err));
  }

  initApp();
});

async function initApp() {
  const token = localStorage.getItem('guest_token');
  const savedSession = localStorage.getItem('guest_session');

  if (savedSession && token) {
    try {
      const parsed = JSON.parse(savedSession);
      // Validate that hotel_id is a 36-char valid UUID string
      if (!parsed.hotel_id || typeof parsed.hotel_id !== 'string' || parsed.hotel_id.length !== 36 || parsed.hotel_id.startsWith('h')) {
        throw new Error('Invalid saved session');
      }
      appState.session = parsed;
      appState.token = token;
      appState.hotel = { id: parsed.hotel_id };
      updateHeaderBadge(appState.session.room_number);
      await fetchMenu(appState.session.hotel_id);
      showScreen('menu');
      initSocketListeners();
      return;
    } catch {
      localStorage.clear();
      appState.session = null;
      appState.token = null;
      appState.hotel = null;
    }
  }

  // Otherwise show check-in screen
  resolveHotelInfo(el.qrInput.value);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.style.display = 'block';
  setTimeout(() => {
    el.toast.style.display = 'none';
  }, 3000);
}

function showScreen(name) {
  Object.keys(screens).forEach(key => {
    if (key === name) {
      screens[key].classList.add('active');
    } else {
      screens[key].classList.remove('active');
    }
  });

  if (name !== 'menu' || getCartTotalCount() === 0) {
    el.cartFloatingBar.classList.add('hidden');
  } else {
    el.cartFloatingBar.classList.remove('hidden');
  }
}

function updateHeaderBadge(roomNum) {
  el.badgeRoomNum.textContent = roomNum;
  el.guestRoomBadge.style.display = 'block';
}

// 1. QR Code Resolve
async function resolveHotelInfo(qrToken) {
  if (!qrToken) return null;
  try {
    const res = await fetch(`/api/hotels/${encodeURIComponent(qrToken)}/resolve`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'QR токен олдсонгүй.');
    }
    const data = await res.json();
    if (!data.id) throw new Error('Буудлын тохиргоо олдсонгүй.');
    appState.hotel = data;
    el.hotelName.textContent = data.name;
    el.hotelAddress.textContent = data.address || 'In-Room Dining Service';
    return data;
  } catch (err) {
    appState.hotel = null;
    showToast(err.message);
    return null;
  }
}

el.qrInput.addEventListener('change', (e) => resolveHotelInfo(e.target.value));

// 2. Geolocation Verification
el.btnVerifyGeo.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Таны хөтөч байршил тогтоохыг дэмжихгүй байна.');
    return;
  }

  el.geoText.textContent = 'Байршил тогтоож байна...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      appState.geoCoords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      el.geoDot.classList.add('verified');
      el.geoText.textContent = '📍 Байршил бүртгэгдлээ';
      showToast('Байршил амжилттай бүртгэгдлээ!');
    },
    () => {
      el.geoText.textContent = 'Байршил авахад алдаа гарлаа';
      showToast('Байршил авах зөвшөөрөл олгогдоогүй.');
    }
  );
});

// 3. Check-in & Session Creation
el.checkinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const guest_name = el.guestNameInput.value.trim();
  const room_number = el.roomNumInput.value.trim();
  const qr_token = el.qrInput.value.trim();

  if (!appState.hotel || !appState.hotel.id) {
    await resolveHotelInfo(qr_token);
  }

  if (!appState.hotel || !appState.hotel.id) {
    showToast('Буудлын QR токен буруу эсвэл олдсонгүй.');
    return;
  }

  try {
    const payload = {
      hotel_id: appState.hotel.id,
      guest_name,
      room_number,
      geo_lat: appState.geoCoords ? appState.geoCoords.lat : null,
      geo_lng: appState.geoCoords ? appState.geoCoords.lng : null
    };

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Сесс үүсгэхэд алдаа гарлаа');

    appState.session = data.session;
    appState.token = data.token;
    localStorage.setItem('guest_token', data.token);
    localStorage.setItem('guest_session', JSON.stringify(data.session));

    updateHeaderBadge(room_number);
    initSocketListeners();

    await fetchMenu(appState.hotel.id);
    showScreen('menu');
    showToast(`Тавтай морилно уу, ${guest_name}!`);
  } catch (err) {
    showToast(err.message);
  }
});

// 4. Menu Fetching & Rendering
async function fetchMenu(hotelId) {
  try {
    const res = await fetch(`/api/menu/${hotelId}`);
    const data = await res.json();
    appState.menuItems = data;
    renderCategories();
    renderMenu();
  } catch (err) {
    showToast('Цэс уншихад алдаа гарлаа: ' + err.message);
  }
}

function renderCategories() {
  const categories = ['all', ...new Set(appState.menuItems.map(item => item.category).filter(Boolean))];
  el.categoriesContainer.innerHTML = categories.map(cat => `
    <button class="category-tab ${cat === appState.selectedCategory ? 'active' : ''}" data-cat="${cat}">
      ${cat === 'all' ? 'Бүгд' : cat}
    </button>
  `).join('');

  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      appState.selectedCategory = e.target.dataset.cat;
      renderCategories();
      renderMenu();
    });
  });
}

function renderMenu() {
  const search = el.menuSearch.value.toLowerCase();
  const filtered = appState.menuItems.filter(item => {
    const matchesCat = appState.selectedCategory === 'all' || item.category === appState.selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(search);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    el.menuGrid.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px;">Хоол олдсонгүй</div>`;
    return;
  }

  el.menuGrid.innerHTML = filtered.map(item => {
    const cartQty = appState.cart[item.id] ? appState.cart[item.id].qty : 0;
    return `
      <div class="menu-card">
        <div class="menu-details">
          ${item.category ? `<div class="menu-tag">${item.category}</div>` : ''}
          <div class="menu-name">${item.name}</div>
          <div class="menu-price">$${Number(item.price_usd).toFixed(2)}</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCart('${item.id}', -1)">-</button>
          <span class="qty-num">${cartQty}</span>
          <button class="qty-btn" onclick="updateCart('${item.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

el.menuSearch.addEventListener('input', renderMenu);

// 5. Cart Logic
window.updateCart = function (itemId, delta) {
  const item = appState.menuItems.find(i => i.id === itemId);
  if (!item) return;

  if (!appState.cart[itemId]) {
    appState.cart[itemId] = { item, qty: 0 };
  }

  appState.cart[itemId].qty += delta;

  if (appState.cart[itemId].qty <= 0) {
    delete appState.cart[itemId];
  }

  renderMenu();
  updateCartBar();
};

function getCartTotalCount() {
  return Object.values(appState.cart).reduce((sum, entry) => sum + entry.qty, 0);
}

function getCartTotalPrice() {
  return Object.values(appState.cart).reduce((sum, entry) => sum + (Number(entry.item.price_usd) * entry.qty), 0);
}

function updateCartBar() {
  const totalCount = getCartTotalCount();
  const totalPrice = getCartTotalPrice();

  if (totalCount > 0 && screens.menu.classList.contains('active')) {
    el.cartFloatingBar.classList.remove('hidden');
    el.cartCountBadge.textContent = totalCount;
    el.cartTotalPrice.textContent = `$${totalPrice.toFixed(2)}`;
  } else {
    el.cartFloatingBar.classList.add('hidden');
  }
}

// Cart Modal
el.cartFloatingBar.addEventListener('click', () => {
  renderCartModal();
  el.cartModal.classList.add('active');
});

el.btnCloseCart.addEventListener('click', () => {
  el.cartModal.classList.remove('active');
});

function renderCartModal() {
  const items = Object.values(appState.cart);
  if (items.length === 0) {
    el.cartItemsContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:30px;">Сагс хоосон байна.</div>`;
    el.modalCartTotal.textContent = '$0.00';
    return;
  }

  el.cartItemsContainer.innerHTML = items.map(entry => `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--border-color);">
      <div>
        <div style="font-weight:700; font-size:0.95rem;">${entry.item.name}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">$${Number(entry.item.price_usd).toFixed(2)} x ${entry.qty}</div>
      </div>
      <div style="font-weight:700; color:var(--success);">$${(Number(entry.item.price_usd) * entry.qty).toFixed(2)}</div>
    </div>
  `).join('');

  el.modalCartTotal.textContent = `$${getCartTotalPrice().toFixed(2)}`;
}

// 6. Place Order
el.btnPlaceOrder.addEventListener('click', async () => {
  const items = Object.values(appState.cart).map(entry => ({
    menu_item_id: entry.item.id,
    quantity: entry.qty,
    guest_name: appState.session ? appState.session.guest_name : 'Guest'
  }));

  if (items.length === 0) {
    showToast('Сагс хоосон байна.');
    return;
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.token}`
      },
      body: JSON.stringify({ items })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Захиалга хийхэд алдаа гарлаа');

    appState.activeOrder = data;
    appState.cart = {};
    updateCartBar();
    el.cartModal.classList.remove('active');

    renderOrderTracking(data);
    showScreen('order');
    showToast('Захиалга амжилттай үүсгэгдлээ!');
  } catch (err) {
    showToast(err.message);
  }
});

// 7. Real-time Order Status & Socket Listener
function renderOrderTracking(order) {
  el.orderIdDisp.textContent = '#' + order.id.slice(0, 8);
  el.orderTotalDisp.textContent = `$${Number(order.total_usd).toFixed(2)}`;

  const statusMap = {
    pending: { text: 'Хүлээгдэж байна', class: 'status-pending', title: 'Захиалга хүлээн авлаа', desc: 'Гал тогоо захиалгыг бэлтгэж эхлэхийг хүлээж байна.' },
    paid: { text: 'Төлбөр төлөгдсөн', class: 'status-paid', title: 'Гүйлгээ амжилттай', desc: 'Захиалгын төлбөр амжилттай хийгдсэн. Баярлалаа!' }
  };

  const current = statusMap[order.status] || statusMap.pending;
  el.orderStatusBadge.className = `status-badge ${current.class}`;
  el.orderStatusBadge.textContent = current.text;
  el.orderStatusTitle.textContent = current.title;
  el.orderStatusDesc.textContent = current.desc;
}

function initSocketListeners() {
  if (!appState.socket || !appState.session) return;
  // Join hotel room
  appState.socket.emit('admin:join', appState.session.hotel_id);

  appState.socket.on('order:updated', (updatedOrder) => {
    if (appState.activeOrder && appState.activeOrder.id === updatedOrder.id) {
      appState.activeOrder = updatedOrder;
      renderOrderTracking(updatedOrder);
      showToast(`Захиалгын статус шинэчлэгдлээ: ${updatedOrder.status}`);
    }
  });
}

// Payment Initiation Modal / Trigger
el.btnPayNow.addEventListener('click', async () => {
  if (!appState.activeOrder) return;

  try {
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: appState.activeOrder.id,
        gateway_provider: '2C2P'
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Төлбөр эхлүүлэхэд алдаа гарлаа');

    showToast(`Төлбөрийн сүлжээнд холбогдлоо! Ref: ${data.transaction_id.slice(0, 15)}...`);
  } catch (err) {
    showToast(err.message);
  }
});

el.btnNewOrder.addEventListener('click', () => {
  showScreen('menu');
});
