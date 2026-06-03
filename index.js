// ============================================================
// GMFC Jersey 2026 — Dashboard Application Logic
// ============================================================

// Seed data embedded directly to avoid cross-script loading issues
const SEED_DATA = typeof jerseyOrdersData !== 'undefined' ? jerseyOrdersData : [];


let orders = [];
let selectedOrderId = null;
let isAdmin = false;
const ADMIN_PASSWORD = 'JerseyGMFC2026';

// ── Admin Auth ───────────────────────────────────────────────

const applyAdminUI = () => {
  const addBtn    = el('open-modal-btn');
  const loginBtn  = el('admin-login-btn');
  const logoutBtn = el('admin-logout-btn');
  if (addBtn)    addBtn.style.display    = isAdmin ? 'flex'   : 'none';
  if (loginBtn)  loginBtn.style.display  = isAdmin ? 'none'   : 'flex';
  if (logoutBtn) logoutBtn.style.display = isAdmin ? 'flex'   : 'none';
  // Re-render table to show/hide Edit/Delete columns
  renderApp();
};

const adminLogin = (password) => {
  if (password === ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem('gmfc_admin', '1');
    closeAdminModal();
    applyAdminUI();
    showToast('Login admin berhasil! Selamat datang.', 'success');
  } else {
    const errEl = el('admin-error-msg');
    if (errEl) errEl.style.display = 'block';
  }
};

const adminLogout = () => {
  el('confirm-logout-overlay').classList.add('active');
};

const confirmLogout = () => {
  isAdmin = false;
  sessionStorage.removeItem('gmfc_admin');
  applyAdminUI();
  el('confirm-logout-overlay').classList.remove('active');
  showToast('Anda telah keluar dari mode admin.', 'info');
};

const cancelLogout = () => {
  el('confirm-logout-overlay').classList.remove('active');
};

const openAdminModal = () => {
  const overlay = el('admin-modal-overlay');
  const passInput = el('admin-password-input');
  const errEl = el('admin-error-msg');
  if (overlay) overlay.classList.add('active');
  if (passInput) { passInput.value = ''; passInput.focus(); }
  if (errEl) errEl.style.display = 'none';
};

const closeAdminModal = () => {
  const overlay = el('admin-modal-overlay');
  if (overlay) overlay.classList.remove('active');
};

window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;



const formatCurrency = (amount) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const isLunas = (order) => {
  if (!order || !order.paymentStatus) return false;
  return order.paymentStatus.toUpperCase().startsWith('LUNAS');
};

function resetFilters() {
  const categoryTabs = document.querySelectorAll('#category-tabs .tab-btn');
  const statusTabs = document.querySelectorAll('#status-tabs .tab-btn');
  categoryTabs.forEach((tab, i) => {
    if (i === 0) tab.classList.add('active');
    else tab.classList.remove('active');
  });
  statusTabs.forEach((tab, i) => {
    if (i === 0) tab.classList.add('active');
    else tab.classList.remove('active');
  });
}
const el = (id) => document.getElementById(id);

// ── Data Persistence ────────────────────────────────────────

const saveToLocalStorage = () => {
  try {
    localStorage.setItem('gmfc_jersey_orders', JSON.stringify(orders));
  } catch (e) {
    console.error('Gagal menyimpan ke localStorage:', e);
  }
};

const loadData = () => {
  try {
    const raw = localStorage.getItem('gmfc_jersey_orders');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        orders = parsed.map(o => {
          if (o.hasSubsidy === undefined) {
            const isAdult = o.category === "Dewasa / Umum";
            const diff = (o.price || 0) - (o.paid || 0);
            const isBob = o.id === 33;
            o.hasSubsidy = isAdult && !isBob && (diff === 45000 || diff === 50000 || (o.paymentStatus === "" && diff > 0));
          }
          return o;
        });
        return;
      }
    }
  } catch (e) {
    console.warn('localStorage korup, reset ke data awal.', e);
  }
  // Fallback to seed data when no valid stored data
  orders = SEED_DATA.map(o => {
    const item = { ...o };
    if (item.hasSubsidy === undefined) {
      const isAdult = item.category === "Dewasa / Umum";
      const diff = (item.price || 0) - (item.paid || 0);
      const isBob = item.id === 33;
      item.hasSubsidy = isAdult && !isBob && (diff === 45000 || diff === 50000 || (item.paymentStatus === "" && diff > 0));
    }
    return item;
  });
  saveToLocalStorage();
};



// ── Filtering ───────────────────────────────────────────────

const getFilteredOrders = () => {
  const searchEl = el('search-input');
  const query = searchEl ? searchEl.value.toLowerCase().trim() : '';

  const activeCategory = (() => {
    const btn = document.querySelector('#category-tabs .tab-btn.active');
    return btn ? btn.textContent.trim() : 'Semua Kategori';
  })();

  const activeStatus = (() => {
    const btn = document.querySelector('#status-tabs .tab-btn.active');
    return btn ? btn.textContent.trim() : 'Semua Status';
  })();

  return orders.filter((order) => {
    const matchSearch =
      !query ||
      (order.name || '').toLowerCase().includes(query) ||
      (order.number || '').toLowerCase().includes(query) ||
      (order.customer || '').toLowerCase().includes(query) ||
      (order.notes || '').toLowerCase().includes(query);

    let matchCategory = true;
    if (activeCategory === 'Anak-Anak') matchCategory = order.category === 'Anak-Anak';
    else if (activeCategory === 'Dewasa / Umum') matchCategory = order.category === 'Dewasa / Umum';

    let matchStatus = true;
    const lunas = isLunas(order);
    if (activeStatus === 'Lunas') matchStatus = lunas;
    else if (activeStatus === 'Belum Lunas') matchStatus = !lunas;

    return matchSearch && matchCategory && matchStatus;
  });
};

// ── Rendering ───────────────────────────────────────────────

const renderStats = (filtered) => {
  const total = orders.length;
  const revenue = orders.reduce((s, o) => s + ((o.hasSubsidy ? o.price - 45000 : o.price) || 0), 0);
  const totalUangMasuk = orders.reduce((s, o) => s + (isLunas(o) ? Math.max(0, o.price - (o.hasSubsidy ? 45000 : 0)) : 0), 0);
  const percPelunasan = revenue > 0 ? (totalUangMasuk / revenue) * 100 : 0;

  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };

  set('stat-total-orders', total);
  set('stat-total-revenue', formatCurrency(revenue));
  set('stat-total-paid', formatCurrency(totalUangMasuk));
  set('settlement-rate-text', `${percPelunasan.toFixed(1)}%`);

  const badge = el('filtered-count-badge');
  if (badge) {
    if (filtered.length === total) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'inline-block';
      badge.textContent = `Menampilkan ${filtered.length} dari ${total} pesanan`;
    }
  }
};

const renderTable = (filtered) => {
  const tbody = document.querySelector('#orders-table tbody');
  if (!tbody) return;

  // Toggle header Aksi
  const header = el('actions-header');
  if (header) {
    header.style.display = isAdmin ? '' : 'none';
  }

  if (filtered.length === 0) {
    const colspan = isAdmin ? 11 : 10;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <h3>Tidak ada data ditemukan</h3>
            <p>Coba ubah kata kunci pencarian atau filter.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((order, idx) => {
    const isSelected = order.id === selectedOrderId;
    const catColor = order.category === 'Anak-Anak'
      ? { bg: 'rgba(59,130,246,0.08)', color: 'var(--info)', border: 'rgba(59,130,246,0.15)' }
      : { bg: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: 'rgba(139,92,246,0.15)' };

    const actionsTd = isAdmin ? `
        <td class="actions-cell" onclick="event.stopPropagation()">
          <button class="btn btn-sm" style="padding:4px 8px;font-size:0.75rem;"
            onclick="editOrder(${order.id})">Edit</button>
          <button class="btn btn-sm" style="padding:4px 8px;font-size:0.75rem;background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.2);color:var(--primary);"
            onclick="deleteOrder(${order.id})">Hapus</button>
        </td>` : '';

    const totalTagihan = Math.max(0, order.price - (order.hasSubsidy ? 45000 : 0));

    return `
      <tr data-order-id="${order.id}" class="${isSelected ? 'selected-row' : ''}" style="cursor:pointer;"
          onclick="handleRowClick(${order.id})">
        <td class="no-column">${idx + 1}</td>
        <td class="name-column">${order.name || '-'}</td>
        <td class="number-column">${order.number || '-'}</td>
        <td class="size-column">${order.size || '-'}</td>
        <td>
          <span class="badge" style="background:${catColor.bg};color:${catColor.color};border-color:${catColor.border};">
            ${order.category}
          </span>
        </td>
        <td>${order.notes || '-'}</td>
        <td>${order.customer || '-'}</td>
        <td>${formatCurrency(totalTagihan)}</td>
        <td>
          <span class="badge ${isLunas(order) ? 'badge-lunas' : 'badge-pending'}">
            ${isLunas(order) ? 'LUNAS' : 'BELUM LUNAS'}
          </span>
        </td>
        <td>${order.paymentDate || '-'}</td>
        ${actionsTd}
      </tr>`;
  }).join('');
};

const renderApp = () => {
  const filtered = getFilteredOrders();
  renderStats(filtered);
  renderTable(filtered);
};

// ── Row Click Handler (global for inline onclick) ────────────

window.handleRowClick = (id) => {
  selectedOrderId = id;
  document.querySelectorAll('tr[data-order-id]').forEach((row) => {
    row.classList.toggle('selected-row', parseInt(row.dataset.orderId) === id);
  });
};

// ── CRUD ────────────────────────────────────────────────────

window.editOrder = (id) => {
  const order = orders.find((o) => o.id === id);
  if (!order) return;

  el('order-id-input').value = order.id;
  el('form-category').value = order.category || 'Dewasa / Umum';
  el('form-name').value = order.name || '';
  el('form-number').value = order.number || '';
  el('form-size').value = order.size || '';
  el('form-notes').value = order.notes || '';
  el('form-customer').value = order.customer || '';
  el('form-tagihan').value = Math.max(0, order.price - (order.hasSubsidy ? 45000 : 0));
  el('form-status').value = isLunas(order) ? 'LUNAS' : 'BELUM LUNAS';
  el('form-date').value = order.paymentDate || '';

  el('modal-title').textContent = 'Edit Pemesanan Jersey';
  el('modal-overlay').classList.add('active');
};

  // Delete with confirmation modal
  let pendingDeleteId = null;
  window.deleteOrder = (id) => {
    pendingDeleteId = id;
    el('confirm-delete-overlay').classList.add('active');
  };
  const confirmDelete = () => {
    if (pendingDeleteId === null) return;
    const idx = orders.findIndex((o) => o.id === pendingDeleteId);
    if (idx !== -1) {
      orders.splice(idx, 1);
      if (selectedOrderId === pendingDeleteId) {
        selectedOrderId = orders.length > 0 ? orders[0].id : null;
      }
      saveToLocalStorage();
      resetFilters(); // Reset category and status filters to show all after deletion
      showToast('Pemesanan berhasil dihapus.', 'info');
      renderApp();
    }
    pendingDeleteId = null;
    el('confirm-delete-overlay').classList.remove('active');
  };
  const cancelDelete = () => {
    pendingDeleteId = null;
    el('confirm-delete-overlay').classList.remove('active');
  };

// ── Modal ───────────────────────────────────────────────────

const openModal = () => {
  const form = el('order-form');
  if (form) form.reset();
  el('modal-title').textContent = 'Tambah Pemesanan Jersey';
  el('order-id-input').value = '';
  el('modal-overlay').classList.add('active');
};

const closeModal = () => {
  el('modal-overlay').classList.remove('active');
};

// ── Toast ───────────────────────────────────────────────────

const showToast = (message, type = 'success') => {
  const toast = el('toast');
  if (!toast) return;
  const icon = type === 'success'
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  toast.className = `toast toast-${type} active`;
  toast.innerHTML = `${icon} <span>${message}</span>`;
  setTimeout(() => toast.classList.remove('active'), 3000);
};



// ── Event Listeners ──────────────────────────────────────────

const setupEventListeners = () => {
  // Theme toggle
  const themeBtn = el('theme-toggle-btn');
  if (themeBtn) {
    const moonIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6.8 6.8 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
    const sunIcon  = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41M18.66 18.66l1.41 1.41M2 12h2M20 12h2m-4.34-7.07-1.41 1.41M5.34 18.66l-1.41 1.41"/></svg>';

    themeBtn.addEventListener('click', () => {
      const cur = document.body.getAttribute('data-theme');
      const next = cur === 'light' ? 'dark' : 'light';
      document.body.setAttribute('data-theme', next);
      localStorage.setItem('gmfc_theme', next);
      themeBtn.innerHTML = next === 'light' ? moonIcon : sunIcon;
    });

    // Apply saved theme
    const saved = localStorage.getItem('gmfc_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    themeBtn.innerHTML = saved === 'light' ? moonIcon : sunIcon;
  }

  // Search
  const searchInput = el('search-input');
  if (searchInput) searchInput.addEventListener('input', renderApp);

  // Category tabs
  document.querySelectorAll('#category-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#category-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderApp();
    });
  });

  // Status tabs
  document.querySelectorAll('#status-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#status-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderApp();
    });
  });


  // Open modal button
  const openBtn = el('open-modal-btn');
  if (openBtn) openBtn.addEventListener('click', openModal);

  // Close modal buttons
  const closeBtns = [el('close-modal-btn'), el('cancel-modal-btn')];
  closeBtns.forEach((btn) => { if (btn) btn.addEventListener('click', closeModal); });

  // Click outside modal
  const overlay = el('modal-overlay');
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // Form submit
  const form = el('order-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const idVal = el('order-id-input').value;
      const data = {
        category:      el('form-category').value,
        name:          el('form-name').value.toUpperCase().trim(),
        number:        el('form-number').value.trim(),
        size:          el('form-size').value.trim(),
        notes:         el('form-notes').value.trim(),
        customer:      el('form-customer').value.toUpperCase().trim(),
        price:         parseInt(el('form-tagihan').value) || 0,
        paid:          0,
        hasSubsidy:    false,
        paymentStatus: el('form-status').value.trim(),
        paymentDate:   el('form-date').value.trim(),
      };

      if (idVal) {
        const idx = orders.findIndex((o) => o.id === parseInt(idVal));
        if (idx !== -1) { orders[idx] = { ...orders[idx], ...data }; }
        showToast('Pesanan berhasil diperbarui!', 'success');
      } else {
        data.id = orders.length > 0 ? Math.max(...orders.map((o) => o.id)) + 1 : 1;
        orders.push(data);
        showToast('Pesanan baru berhasil ditambahkan!', 'success');
      }

      saveToLocalStorage();
      closeModal();
      renderApp();
    });
  }


  // Admin button listeners
  const adminLoginBtn = el('admin-login-btn');
  if (adminLoginBtn) adminLoginBtn.addEventListener('click', openAdminModal);

  const adminLogoutBtn = el('admin-logout-btn');
  if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', adminLogout);

  const closeAdminBtn = el('close-admin-modal-btn');
  if (closeAdminBtn) closeAdminBtn.addEventListener('click', closeAdminModal);

  const cancelAdminBtn = el('cancel-admin-btn');
  if (cancelAdminBtn) cancelAdminBtn.addEventListener('click', closeAdminModal);

  const submitAdminBtn = el('submit-admin-btn');
  const passwordInput = el('admin-password-input');

  const handleAdminSubmit = () => {
    if (passwordInput) {
      adminLogin(passwordInput.value);
    }
  };
  window.handleAdminSubmit = handleAdminSubmit;

  if (submitAdminBtn) submitAdminBtn.addEventListener('click', handleAdminSubmit);
  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAdminSubmit();
    });
  }

  // Click outside admin modal
  const adminOverlay = el('admin-modal-overlay');
  if (adminOverlay) {
    adminOverlay.addEventListener('click', (e) => {
      if (e.target === adminOverlay) closeAdminModal();
    });
  }

  // Delete modal bindings
  const confirmBtn = el('confirm-delete-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmDelete);
  const cancelBtn = el('cancel-delete-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelDelete);
  const closeDelBtn = el('close-delete-btn');
  if (closeDelBtn) closeDelBtn.addEventListener('click', cancelDelete);

  // Logout modal bindings
  const confirmLogoutBtn = el('confirm-logout-btn');
  if (confirmLogoutBtn) confirmLogoutBtn.addEventListener('click', confirmLogout);
  const cancelLogoutBtn = el('cancel-logout-btn');
  if (cancelLogoutBtn) cancelLogoutBtn.addEventListener('click', cancelLogout);
  const closeLogoutBtn = el('close-logout-btn');
  if (closeLogoutBtn) closeLogoutBtn.addEventListener('click', cancelLogout);
};

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('gmfc_admin') === '1') {
    isAdmin = true;
  }
  loadData();
  setupEventListeners();
  applyAdminUI();
});
