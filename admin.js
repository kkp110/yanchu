let menu = [];
let githubToken = localStorage.getItem('yanchu_token') || '';
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const GITHUB_API = 'https://api.github.com/repos/kkp110/yanchu/contents';

// Tab 切换
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

// ===== GitHub API 读写 =====
async function readFile(path) {
  const r = await fetch(`${path}?${Date.now()}`);
  if (!r.ok) throw new Error('读取失败');
  return await r.json();
}

async function writeFile(path, data) {
  if (!githubToken) { showToast('请先设置 GitHub Token'); return false; }
  // 先获取当前文件的 SHA
  const getRes = await fetch(`${GITHUB_API}/${path}`, {
    headers: { 'Authorization': 'Bearer ' + githubToken, 'Accept': 'application/vnd.github+json' }
  });
  if (!getRes.ok) { showToast('Token 无效或无权限'); return false; }
  const info = await getRes.json();
  const sha = info.sha;

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const putRes = await fetch(`${GITHUB_API}/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + githubToken, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
    body: JSON.stringify({ message: '更新 ' + path, content: content, sha: sha })
  });
  if (!putRes.ok) { showToast('保存失败'); return false; }
  return true;
}

// ===== Token 管理 =====
function checkToken() {
  if (!githubToken || githubToken.length < 10) {
    githubToken = prompt('请输入 GitHub Personal Access Token（仅保存在本浏览器）:\n\n获取方式: github.com → Settings → Developer settings → Personal access tokens → Generate new token (classic) → 勾选 repo 权限', githubToken || '');
    if (githubToken) { localStorage.setItem('yanchu_token', githubToken); showToast('Token 已保存'); }
  }
}

// ===== 菜单管理 =====
async function loadMenu() {
  try { menu = await readFile('menu.json'); renderList(); } catch(e) { menu = []; renderList(); }
}

function renderList() {
  const c = $('#itemList');
  if (!menu.length) { c.innerHTML = '<p style="color:var(--muted)">暂无菜品，请添加。</p>'; return; }
  c.innerHTML = menu.map((item, i) => `
    <div class="dish-item">
      <img src="${item.img}" alt="${item.name}" onerror="this.src='images/default.svg'" />
      <div class="dish-info">
        <strong>${item.name}</strong>
        <span>¥${Number(item.price).toFixed(2)} · ${item.category||'未分类'} · ${item.availableToday?'有货':'售罄'}</span>
      </div>
      <div class="dish-actions">
        <button class="btn-edit" data-idx="${i}">编辑</button>
        <button class="btn-del" data-idx="${i}">删除</button>
      </div>
    </div>`).join('');
  $$('.btn-edit').forEach(b => b.addEventListener('click', () => editItem(parseInt(b.dataset.idx))));
  $$('.btn-del').forEach(b => b.addEventListener('click', () => deleteItem(parseInt(b.dataset.idx))));
}

function editItem(idx) {
  const item = menu[idx], form = $('#itemForm');
  form.name.value = item.name; form.price.value = item.price;
  form.category.value = item.category || ''; form.desc.value = item.desc || '';
  form.availableToday.value = item.availableToday ? 'true' : 'false';
  form.dataset.editIdx = idx;
  form.querySelector('button').textContent = '更新菜品';
  document.querySelector('.tab-btn[data-tab="tab-menu"]').click();
}

function deleteItem(idx) {
  if (!confirm(`确定删除"${menu[idx].name}"吗？`)) return;
  menu.splice(idx, 1); saveMenu();
}

async function saveMenu() {
  checkToken();
  const ok = await writeFile('menu.json', menu);
  if (ok) { renderList(); showToast('菜单已保存（约5秒后生效）'); }
}

$('#itemForm').addEventListener('submit', async function(e) {
  e.preventDefault(); checkToken();
  const form = e.target;
  const name = form.name.value.trim();
  const price = parseFloat(form.price.value);
  if (!name) return showToast('请输入菜名');
  if (isNaN(price) || price < 0) return showToast('请输入有效价格');

  const imgFile = $('#imageInput').files[0];
  let imgPath = 'images/default.svg';
  if (imgFile) {
    imgPath = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(imgFile); });
  }
  const dish = {
    id: form.dataset.editIdx ? menu[parseInt(form.dataset.editIdx)].id : (menu.length ? Math.max(...menu.map(d=>d.id))+1 : 1),
    name, price, category: form.category.value.trim(), desc: form.desc.value.trim(),
    availableToday: form.availableToday.value === 'true', img: imgPath
  };
  if (form.dataset.editIdx !== undefined && form.dataset.editIdx !== '') {
    menu[parseInt(form.dataset.editIdx)] = dish;
    delete form.dataset.editIdx;
    form.querySelector('button').textContent = '保存菜品';
  } else { menu.push(dish); }
  await saveMenu(); form.reset(); $('#imageInput').value = '';
});

// ===== 收款码 =====
async function loadPaymentConfig() {
  try { const cfg = await readFile('config.json');
    if (cfg.paymentQR) { $('#currentQR').src=cfg.paymentQR; $('#currentQR').style.display='block'; $('#noQR').style.display='none'; }
  } catch(e){}
}

$('#savePaymentQR').addEventListener('click', async function() {
  checkToken();
  const file = $('#paymentQRInput').files[0];
  if (!file) return showToast('请先选择收款码图片');
  const qrData = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
  const ok = await writeFile('config.json', { paymentQR: qrData });
  if (ok) { showToast('收款码已保存'); loadPaymentConfig(); }
});

// ===== 订单 =====
async function loadOrders() {
  const c = $('#orderListContainer');
  try { const orders = await readFile('orders.json');
    if (!orders.length) { c.innerHTML='<p style="color:rgba(255,255,255,0.3);text-align:center;padding:30px">暂无订单</p>'; return; }
    c.innerHTML = orders.map(o => `
      <div class="order-item">
        <div class="order-header">
          <span class="order-id">#${o.id}</span>
          <span class="order-status status-new">${o.status||'已下单'}</span>
          <span class="order-total">￥${Number(o.total).toFixed(2)}</span>
        </div>
        <div class="order-meta">${o.people||'?'}人就餐 · ${o.time||''}</div>
        <div class="order-dishes">${(o.items||[]).map(i=>`<div>· ${i.name} ￥${Number(i.price).toFixed(2)}</div>`).join('')}</div>
      </div>`).join('');
  } catch(e) { c.innerHTML='<p class="error">加载订单失败</p>'; }
}

$('#refreshOrders').addEventListener('click', loadOrders);

function showToast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'),2000);
}

loadMenu(); loadPaymentConfig();
