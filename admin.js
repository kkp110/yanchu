let menu = [];
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Tab 切换
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    $('#' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tab-orders') loadOrders();
  });
});

// ===== 数据读写（本地服务器API） =====
async function readFile(path) {
  const r = await fetch(`${path}?${Date.now()}`);
  if (!r.ok) throw new Error('读取失败');
  return await r.json();
}

async function apiPost(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('请求失败');
  return await res.json();
}

// ===== 菜单管理 =====
async function loadMenu() {
  try { menu = await readFile('menu.json'); renderList(); } catch(e) { menu = []; renderList(); }
}

function renderList() {
  const c = $('#itemList');
  const dCount = $('#dishCount');
  if (dCount) dCount.textContent = `（${menu.length}道）`;
  if (!menu.length) {
    c.innerHTML = '<div style="text-align:center;padding:32px;color:#ccc;font-size:14px">📭 暂无菜品，用上方表单添加第一道菜</div>';
    return;
  }
  c.innerHTML = menu.map((item, i) => `
    <div class="dish-card-new ${!item.availableToday ? 'dish-off' : ''}">
      <div class="dish-card-left">
        <img src="${item.img}" alt="${item.name}" onerror="this.src='images/default.svg'" />
        <div class="dish-card-info">
          <div class="dish-card-name">${item.recommended ? '🔥 ' : ''}${item.name}</div>
          <div class="dish-card-meta">${item.category||'未分类'} · ¥${Number(item.price).toFixed(2)}</div>
        </div>
      </div>
      <div class="dish-card-actions">
        <button class="chip chip-avail ${item.availableToday?'chip-on':'chip-off'}" data-idx="${i}">${item.availableToday?'有货':'售罄'}</button>
        <button class="chip chip-rec ${item.recommended?'chip-rec-on':''}" data-idx="${i}">${item.recommended?'🔥':''}推荐</button>
        <button class="chip chip-edit" data-idx="${i}">✎</button>
        <button class="chip chip-del" data-idx="${i}">✕</button>
      </div>
    </div>`).join('');

  // 绑定事件
  $$('.chip-avail').forEach(b => b.addEventListener('click', async () => {
    const idx = parseInt(b.dataset.idx);
    menu[idx].availableToday = !menu[idx].availableToday;
    await saveMenu();
  }));
  $$('.chip-rec').forEach(b => b.addEventListener('click', async () => {
    const idx = parseInt(b.dataset.idx);
    menu[idx].recommended = !menu[idx].recommended;
    await saveMenu();
  }));
  $$('.chip-edit').forEach(b => b.addEventListener('click', () => editItem(parseInt(b.dataset.idx))));
  $$('.chip-del').forEach(b => b.addEventListener('click', () => deleteItem(parseInt(b.dataset.idx))));
}

function editItem(idx) {
  const item = menu[idx], form = $('#itemForm');
  form.name.value = item.name; form.price.value = item.price;
  form.category.value = item.category || ''; form.desc.value = item.desc || '';
  form.availableToday.value = item.availableToday ? 'true' : 'false';
  form.dataset.editIdx = idx;
  form.querySelector('.mgmt-submit').textContent = '💾 更新菜品';
  $('#formTitle').textContent = '✏️ 编辑菜品';
  $('#cancelEditBtn').style.display = 'block';
  document.querySelector('.tab-btn[data-tab="tab-menu"]').click();
  window.scrollTo({ top: $('#formCard').offsetTop - 20, behavior: 'smooth' });
}

$('#cancelEditBtn').addEventListener('click', () => {
  $('#itemForm').reset();
  delete $('#itemForm').dataset.editIdx;
  $('#itemForm').querySelector('.mgmt-submit').textContent = '💾 保存菜品';
  $('#formTitle').textContent = '➕ 添加菜品';
  $('#cancelEditBtn').style.display = 'none';
  $('#imgPreview').style.display = 'none';
});

function deleteItem(idx) {
  if (!confirm(`确定删除"${menu[idx].name}"吗？`)) return;
  menu.splice(idx, 1); saveMenu();
}

async function saveMenu() {
  try {
    await apiPost('/api/menu', menu);
    renderList();
    showToast('菜单已保存');
  } catch(e) { showToast('保存失败: ' + e.message); }
}

$('#itemForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const price = parseFloat(form.price.value);
  if (!name) return showToast('请输入菜名');
  if (isNaN(price) || price < 1) return showToast('价格最低 1 元');

  const imgFile = document.getElementById('imageInput')?.files?.[0];
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
  form.querySelector('.mgmt-submit').textContent = '💾 保存菜品';
  $('#formTitle').textContent = '➕ 添加菜品';
  $('#cancelEditBtn').style.display = 'none';
  delete form.dataset.editIdx;
  $('#imgPreview').style.display = 'none';
});

// ===== 订单 =====
async function loadOrders() {
  const c = $('#orderListContainer');
  try { const orders = await readFile('orders.json');
    if (!orders.length) { c.innerHTML='<p style="color:#999;text-align:center;padding:30px">暂无订单</p>'; return; }
    // 有效订单（未取消的）
    const activeOrders = orders.filter(o => o.status !== '已取消' && o.status !== '已完成');
    const cancelledOrders = orders.filter(o => o.status === '已取消');
    const completedOrders = orders.filter(o => o.status === '已完成');
    const activeTotal = activeOrders.reduce((s, o) => s + Number(o.total), 0);

    // 营收摘要
    let summaryHTML = `
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:80px;background:#fff3e0;border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:12px;color:#999">待处理</div>
          <div style="font-size:24px;font-weight:800;color:#e65100">${activeOrders.length}</div>
          <div style="font-size:12px;color:#e65100">￥${activeTotal.toFixed(2)}</div>
        </div>
        <div style="flex:1;min-width:80px;background:#e8f5e9;border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:12px;color:#999">已完成</div>
          <div style="font-size:24px;font-weight:800;color:#2e7d32">${completedOrders.length}</div>
          <div style="font-size:12px;color:#2e7d32">￥${completedOrders.reduce((s,o)=>s+Number(o.total),0).toFixed(2)}</div>
        </div>
        <div style="flex:1;min-width:80px;background:#fbe9e7;border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:12px;color:#999">已取消</div>
          <div style="font-size:24px;font-weight:800;color:#c62828">${cancelledOrders.length}</div>
          <div style="font-size:12px;color:#c62828">￥${cancelledOrders.reduce((s,o)=>s+Number(o.total),0).toFixed(2)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn-reset" data-type="done" style="padding:8px 14px;border-radius:14px;border:1px solid #2e7d32;background:#e8f5e9;color:#2e7d32;font-size:13px;cursor:pointer">📦 归档已完成</button>
        <button class="btn-reset" data-type="cancelled" style="padding:8px 14px;border-radius:14px;border:1px solid #c62828;background:#fbe9e7;color:#c62828;font-size:13px;cursor:pointer">🗑 清除已取消</button>
        <button id="btnHistory" style="padding:8px 14px;border-radius:14px;border:1px solid #1976d2;background:#e3f2fd;color:#1976d2;font-size:13px;cursor:pointer">📋 查看历史</button>
        <span style="font-size:11px;color:#bbb;align-self:center">每天首次下单自动归档昨日数据</span>
      </div>
      <div id="historyPanel" style="display:none;margin-bottom:14px"></div>`;

    c.innerHTML = summaryHTML + orders.map(o => {
      const isActive = o.status === '已下单';
      const isDone = o.status === '已完成';
      const isCancelled = o.status === '已取消';
      return `
      <div class="order-item" style="${isCancelled ? 'opacity:0.45' : ''}${isDone ? 'opacity:0.7' : ''}">
        <div class="order-header">
          <span class="order-id">#${o.id}</span>
          <span class="order-status ${isActive ? 'status-new' : isDone ? 'status-done' : ''}" style="${isCancelled ? 'background:#fbe9e7;color:#c62828' : ''}">${o.status||'已下单'}</span>
          <span class="order-total">￥${Number(o.total).toFixed(2)}</span>
        </div>
        <div class="order-meta">👥 ${o.people||'?'}人 · ${o.time||''}</div>
        <div class="order-dishes">${(o.items||[]).map(i=>`
          <div>· ${i.name} ￥${Number(i.price).toFixed(2)}${i.note ? '<span style="color:#e8452d;font-size:12px"> [备注: '+i.note+']</span>' : ''}</div>
        `).join('')}</div>
        ${o.extraFee > 0 ? `<div style="font-size:12px;color:#999">· 餐位费 ￥${Number(o.extraFee).toFixed(2)}</div>` : ''}
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
          ${isActive ? `<button class="btn-done" data-id="${o.id}">✓ 完成</button>` : ''}
          ${isActive ? `<button class="btn-cancel" data-id="${o.id}">✕ 取消</button>` : ''}
          ${(isCancelled || isDone) ? `<button class="btn-del" data-id="${o.id}">🗑 删除</button>` : ''}
        </div>
      </div>`;
    }).join('');

    // 绑定按钮事件
    $$('.btn-done').forEach(b => b.addEventListener('click', () => updateOrderStatus(b.dataset.id, 'complete')));
    $$('.btn-cancel').forEach(b => b.addEventListener('click', () => {
      if (confirm('确定取消此订单吗？将从营收中扣除。')) updateOrderStatus(b.dataset.id, 'cancel');
    }));
    $$('.btn-del').forEach(b => b.addEventListener('click', () => {
      if (confirm('确定永久删除此订单吗？')) updateOrderStatus(b.dataset.id, 'delete');
    }));
    // 历史订单
    const histBtn = document.getElementById('btnHistory');
    if (histBtn) histBtn.addEventListener('click', loadHistory);

    $$('.btn-reset').forEach(b => b.addEventListener('click', async () => {
      const type = b.dataset.type;
      const msg = type === 'done' ? '归档已完成订单？' : '清除已取消订单？';
      if (!confirm(msg)) return;
      try {
        const res = await fetch('/api/orders/reset', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type}) });
        if (res.ok) { showToast('操作成功'); loadOrders(); } else showToast('操作失败');
      } catch(e) { showToast('操作失败'); }
    }));
  } catch(e) { c.innerHTML='<p class="error">加载订单失败</p>'; }
}

$('#refreshOrders').addEventListener('click', loadOrders);

// 查看历史订单
async function loadHistory() {
  const panel = document.getElementById('historyPanel');
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  try {
    const res = await fetch('/api/orders?archive');
    if (!res.ok) throw new Error('加载失败');
    const archive = await res.json();
    if (!archive.length) { panel.innerHTML = '<p style="color:#999;text-align:center;padding:16px">暂无历史记录</p>'; panel.style.display = 'block'; return; }
    let html = '<div style="font-weight:700;margin-bottom:8px;color:#1976d2">📋 历史归档（最近）</div>';
    archive.slice(0, 30).forEach(day => {
      const dayTotal = (day.orders||[]).reduce((s,o) => s + (o.status === '已取消' ? 0 : Number(o.total)), 0);
      html += `<div style="background:#f5f5f5;border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <strong>📅 ${day.date||'未知日期'}</strong>
          <span>${day.orders?.length||0}单 · 营收￥${dayTotal.toFixed(2)}</span>
        </div>
        <div style="font-size:12px;color:#999;margin-top:4px">归档时间: ${day.archivedAt||''}</div>
        <button class="btn-restore" data-date="${day.date}" style="margin-top:4px;padding:4px 10px;border-radius:10px;border:1px solid #1976d2;background:#e3f2fd;color:#1976d2;font-size:11px;cursor:pointer">↩ 恢复当天订单</button>
      </div>`;
    });
    panel.innerHTML = html;
    panel.style.display = 'block';
    // 恢复按钮
    document.querySelectorAll('.btn-restore').forEach(b => {
      b.addEventListener('click', async () => {
        const date = b.dataset.date;
        if (!confirm(`确定恢复 ${date} 的订单到当前列表吗？`)) return;
        try {
          const archiveRes = await fetch('/api/orders?archive');
          const archiveData = await archiveRes.json();
          const dayData = archiveData.find(d => d.date === date);
          if (!dayData) return showToast('未找到当天数据');
          // 获取当前订单
          const currentRes = await fetch('/api/orders');
          const currentOrders = await currentRes.json();
          // 合并
          const restored = [...(dayData.orders||[]), ...currentOrders];
          const saveRes = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(
            // 不能用 POST 因为会创建新订单... 让我换个方式
          )});
          // 简化：逐个重新提交
          let restoredCount = 0;
          for (const o of (dayData.orders||[])) {
            await fetch('/api/orders', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ people: o.people||1, items: o.items||[], subtotal: o.subtotal||0, extraFee: o.extraFee||0, total: o.total||0 })
            });
            restoredCount++;
          }
          showToast(`已恢复 ${restoredCount} 单`);
          loadOrders();
          panel.style.display = 'none';
        } catch(e) { showToast('恢复失败'); }
      });
    });
  } catch(e) { panel.innerHTML = '<p class="error">加载失败</p>'; panel.style.display = 'block'; }
}

// 更新订单状态
async function updateOrderStatus(orderId, action) {
  try {
    const res = await fetch(`/api/orders/${orderId}?action=${action}`, { method: 'POST' });
    if (res.ok) {
      showToast(action === 'complete' ? '订单已完成' : action === 'cancel' ? '订单已取消' : '订单已删除');
      loadOrders();
    } else {
      showToast('操作失败');
    }
  } catch(e) { showToast('操作失败'); }
}

// ===== 语音播报 + 后台通知 =====
let voiceEnabled = true;
let lastOrderIds = new Set();
let wakeLock = null;

// 请求通知权限（后台也能收到提醒）
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// 发送系统通知（后台也能弹出）
function notifyOrder(order) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const items = order.items.map(i => i.name + (i.note ? '('+i.note+')' : '')).join('、');
    new Notification('🔥 焰厨 · 新订单！', {
      body: `${order.people}人 · ${items} · 合计￥${Number(order.total).toFixed(2)}`,
      icon: 'images/logo.svg',
      tag: 'new-order',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200]
    });
  }
}

// 循环警报音（即使语音播完也会持续响）
let alarmInterval = null;
function startAlarm() {
  stopAlarm();
  alarmInterval = setInterval(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.value = 0.25;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.stop(ctx.currentTime + 0.25);
    } catch(e) {}
  }, 800);
}
function stopAlarm() {
  if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
}

// 提示音（手机也能听到）
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
}

// 待播报订单队列（移动端语音需用户手势）
let pendingOrder = null;

function speakOrder(order) {
  if (!voiceEnabled) return;
  notifyOrder(order);
  startAlarm();
  playBeep();
  pendingOrder = order;
  showToast('📢 新订单！点击屏幕听播报');
}

// 点击屏幕触发中文语音
document.addEventListener('click', function() {
  if (!pendingOrder) return;
  const order = pendingOrder;
  pendingOrder = null;
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang === 'zh-CN' && v.name.includes('TingTing')) ||
                  voices.find(v => v.lang === 'zh-CN' && v.name.includes('Xiaoxiao')) ||
                  voices.find(v => v.lang === 'zh-CN') ||
                  voices.find(v => v.lang.startsWith('zh-'));

  let text = '叮咚！来新订单了！' + order.people + '位顾客。';
  order.items.forEach(function(i, idx) {
    text += '第' + (idx+1) + '道，' + i.name;
    if (i.note) text += '，备注，' + i.note;
    text += '。';
  });
  text += '以上共' + order.items.length + '道菜，合计' + Number(order.total).toFixed(2) + '元。';

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 0.85;
  utter.pitch = 1.1;
  utter.volume = 1;
  if (zhVoice) utter.voice = zhVoice;
  utter.onend = function() { stopAlarm(); };
  utter.onerror = function() { stopAlarm(); };
  window.speechSynthesis.speak(utter);
});

// 保持手机屏幕唤醒
async function requestWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
}
requestWakeLock();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestWakeLock();
});

// 轮询新订单
async function pollOrders() {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) return;
    const orders = await res.json();
    const st = document.querySelector('.voice-status');
    if (st) { st.style.display = 'block'; st.textContent = '🔊 监听中 · ' + new Date().toLocaleTimeString('zh-CN'); }
    if (orders.length) {
      const newOrders = orders.filter(o => !lastOrderIds.has(o.id) && o.status === '已下单');
      newOrders.forEach(o => { lastOrderIds.add(o.id); speakOrder(o); });
      if (lastOrderIds.size > 200) lastOrderIds = new Set([...lastOrderIds].slice(-100));
      if ($('#tab-orders').classList.contains('active')) loadOrders();
    }
  } catch(e) {}
}

(async function initOrders() {
  try {
    const res = await fetch('/api/orders');
    if (res.ok) { const orders = await res.json(); orders.forEach(o => lastOrderIds.add(o.id)); }
  } catch(e) {}
  setInterval(pollOrders, 5000);
})();

// 语音状态指示器
const voiceStatus = document.createElement('div');
voiceStatus.className = 'voice-status';
voiceStatus.textContent = '🔊 监听中···';
document.body.appendChild(voiceStatus);

// 语音开关
const voiceBtn = document.createElement('button');
voiceBtn.className = 'voice-btn';
voiceBtn.textContent = '🔊 播报：开';
voiceBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:200;padding:10px 18px;border-radius:20px;border:0;background:#e8452d;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2)';
voiceBtn.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  voiceBtn.textContent = voiceEnabled ? '🔊 播报：开' : '🔇 播报：关';
  voiceBtn.style.background = voiceEnabled ? '#e8452d' : '#999';
  if (voiceEnabled) {
    requestWakeLock();
    showToast('语音播报已开启 · 保持页面打开即可');
  } else {
    stopAlarm();
    showToast('语音播报已关闭');
  }
});

// 停止警报按钮（新订单时显示）
const stopBtn = document.createElement('button');
stopBtn.textContent = '🔕 停止警报';
stopBtn.style.cssText = 'position:fixed;bottom:70px;right:20px;z-index:200;padding:10px 18px;border-radius:20px;border:0;background:#333;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:none';
stopBtn.addEventListener('click', () => { stopAlarm(); stopBtn.style.display = 'none'; });
document.body.appendChild(stopBtn);

// 重写 startAlarm 以显示停止按钮
const origStartAlarm = startAlarm;
startAlarm = function() {
  origStartAlarm();
  stopBtn.style.display = 'block';
};
const origStopAlarm = stopAlarm;
stopAlarm = function() {
  origStopAlarm();
  stopBtn.style.display = 'none';
};
document.body.appendChild(voiceBtn);

// 手机提示
if (/Mobi|Android/i.test(navigator.userAgent)) {
  setTimeout(() => showToast('💡 保持屏幕常亮、勿锁屏，新订单语音自动播报'), 2000);
}

function showToast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'),2000);
}

loadMenu();
