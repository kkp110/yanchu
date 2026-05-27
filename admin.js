let menu = [];
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ========== Tab 切换 ==========
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    $('#' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tab-orders') loadOrders();
    if (btn.dataset.tab === 'tab-payment') loadPaymentConfig();
  });
});

// ========== 菜单管理 ==========
async function loadMenu() {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('加载失败');
    menu = await res.json();
    renderList();
  } catch (e) {
    menu = [];
    renderList();
    console.error(e);
  }
}

function renderList() {
  const container = $('#itemList');
  if (!menu.length) {
    container.innerHTML = '<p style="color:var(--muted)">暂无菜品，请添加。</p>';
    return;
  }
  container.innerHTML = menu.map((item, i) => `
    <div class="dish-item">
      <img src="${item.img}" alt="${item.name}" onerror="this.src='images/default.svg'" />
      <div class="dish-info">
        <strong>${item.name}</strong>
        <span>¥${Number(item.price).toFixed(2)} · ${item.category || '未分类'} · ${item.availableToday ? '有货' : '售罄'}</span>
      </div>
      <div class="dish-actions">
        <button class="btn-edit" data-idx="${i}">编辑</button>
        <button class="btn-del" data-idx="${i}">删除</button>
      </div>
    </div>
  `).join('');

  $$('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editItem(parseInt(btn.dataset.idx)));
  });
  $$('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(parseInt(btn.dataset.idx)));
  });
}

function editItem(idx) {
  const item = menu[idx];
  const form = $('#itemForm');
  form.name.value = item.name;
  form.price.value = item.price;
  form.category.value = item.category || '';
  form.desc.value = item.desc || '';
  form.availableToday.value = item.availableToday ? 'true' : 'false';
  form.dataset.editIdx = idx;
  form.querySelector('button').textContent = '更新菜品';
  document.querySelector('.tab-btn[data-tab="tab-menu"]').click();
  window.scrollTo({ top: form.offsetTop - 20, behavior: 'smooth' });
}

function deleteItem(idx) {
  if (!confirm(`确定删除"${menu[idx].name}"吗？`)) return;
  menu.splice(idx, 1);
  saveMenu();
}

async function saveMenu() {
  try {
    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menu)
    });
    if (!res.ok) throw new Error('保存失败');
    renderList();
    showToast('菜单已保存');
  } catch (e) {
    showToast('保存失败: ' + e.message);
  }
}

$('#itemForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const price = parseFloat(form.price.value);
  const category = form.category.value.trim();
  const desc = form.desc.value.trim();
  const availableToday = form.availableToday.value === 'true';

  if (!name) return showToast('请输入菜名');
  if (isNaN(price) || price < 0) return showToast('请输入有效价格');

  const imageFile = $('#imageInput').files[0];
  let imgPath = 'images/default.svg';

  if (imageFile) {
    imgPath = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(imageFile);
    });
  }

  const editIdx = form.dataset.editIdx;
  if (editIdx !== undefined && editIdx !== '') {
    const idx = parseInt(editIdx);
    menu[idx] = { ...menu[idx], name, price, category, desc, availableToday, img: imgPath || menu[idx].img };
    delete form.dataset.editIdx;
    form.querySelector('button').textContent = '保存菜品';
  } else {
    const id = menu.length ? Math.max(...menu.map(d => d.id)) + 1 : 1;
    menu.push({ id, name, price, desc, img: imgPath, availableToday, category });
  }

  await saveMenu();
  form.reset();
  $('#imageInput').value = '';
});

// ========== 收款码管理 ==========
async function loadPaymentConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.paymentQR) {
        $('#currentQR').src = cfg.paymentQR;
        $('#currentQR').style.display = 'block';
        $('#noQR').style.display = 'none';
      } else {
        $('#currentQR').style.display = 'none';
        $('#noQR').style.display = 'block';
      }
    }
  } catch(e) {}
}

$('#savePaymentQR').addEventListener('click', async function() {
  const file = $('#paymentQRInput').files[0];
  if (!file) return showToast('请先选择收款码图片');

  const qrData = await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentQR: qrData })
    });
    if (res.ok) {
      showToast('收款码已保存');
      loadPaymentConfig();
    } else {
      showToast('保存失败');
    }
  } catch(e) {
    showToast('保存失败: ' + e.message);
  }
});

// ========== 订单管理 ==========
async function loadOrders() {
  const container = $('#orderListContainer');
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('加载失败');
    const orders = await res.json();
    if (!orders.length) {
      container.innerHTML = '<p style="color:rgba(255,255,255,0.3);text-align:center;padding:30px">暂无订单</p>';
      return;
    }
    container.innerHTML = orders.map(o => `
      <div class="order-item">
        <div class="order-header">
          <span class="order-id">#${o.id}</span>
          <span class="order-status ${o.status==='已完成'?'status-done':'status-new'}">${o.status||'已下单'}</span>
          <span class="order-total">￥${Number(o.total).toFixed(2)}</span>
        </div>
        <div class="order-meta">${o.people||'?'}人就餐 · ${o.time||''}</div>
        <div class="order-dishes">
          ${(o.items||[]).map(i=>`<div>· ${i.name} ×1  ￥${Number(i.price).toFixed(2)}</div>`).join('')}
          ${o.extraFee > 0 ? `<div style="color:rgba(255,255,255,0.4)">· 餐位费 ￥${Number(o.extraFee).toFixed(2)}</div>` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML = '<p class="error">加载订单失败</p>';
  }
}

$('#refreshOrders').addEventListener('click', loadOrders);

// ========== Toast ==========
function showToast(msg) {
  let toast = $('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ========== 启动 ==========
loadMenu();
loadPaymentConfig();
