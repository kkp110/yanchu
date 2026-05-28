let menu = [];
let cart = [];
let peopleCount = 2;
let paymentQR = '';

// 同域读取数据文件（无跨域问题）

const grid = document.getElementById('menuGrid');
const search = document.getElementById('search');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');

const cartBtn = document.getElementById('cartBtn');
const cartPanel = document.getElementById('cartPanel');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const cartCount = document.getElementById('cartCount');
const cartEmpty = document.getElementById('cartEmpty');
const orderBtn = document.getElementById('orderBtn');
const peopleNum = document.getElementById('peopleNum');
const peopleMinus = document.getElementById('peopleMinus');
const peoplePlus = document.getElementById('peoplePlus');

const payModal = document.getElementById('payModal');
const payClose = document.getElementById('payClose');
const payAmount = document.getElementById('payAmount');
const payQR = document.getElementById('payQR');
const modalAddCart = document.getElementById('modalAddCart');
let currentModalItem = null;

function formatPrice(n){return '￥' + Number(n).toFixed(2)}

function renderList(list){
  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state">当前没有可显示的菜品。</div>';
    return;
  }
  list.forEach(item=>{
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;
    const inCart = cart.filter(c => c.id === item.id).length;
    card.innerHTML = `
      <div class="card-img-wrap" data-action="detail">
        <img src="${item.img}" alt="${item.name}" loading="lazy" onerror="this.src='images/default.svg'" />
        <span class="card-badge ${item.availableToday? 'badge-on':'badge-off'}">${item.availableToday? '今日有货':'今日售罄'}</span>
        ${inCart ? '<span class="cart-tag">已选×'+inCart+'</span>' : ''}
      </div>
      <div class="card-body" data-action="detail">
        <div class="card-header">
          <h3>${item.name}</h3>
          <span class="card-cat">${item.category||''}</span>
        </div>
        <p class="card-desc">${item.desc || ''}</p>
        <div class="card-bottom">
          <span class="card-price">${formatPrice(item.price)}</span>
          ${item.availableToday ? `<button class="card-add-btn" data-action="add" data-id="${item.id}">加入</button>` : '<button class="card-add-btn off" disabled>售罄</button>'}
        </div>
      </div>
    `;
    // 点击加入按钮
    card.querySelector('[data-action="add"]')?.addEventListener('click', e => {
      e.stopPropagation();
      if (item.availableToday) addToCart(item);
    });
    // 点击其他区域打开详情
    card.querySelectorAll('[data-action="detail"]').forEach(el => {
      el.addEventListener('click', () => openModal(item));
    });
    card.addEventListener('keypress',e=>{ if(e.key==='Enter') openModal(item) });
    grid.appendChild(card);
  });
}

function openModal(item){
  currentModalItem = item;
  document.getElementById('modalImg').src = item.img;
  document.getElementById('modalTitle').textContent = item.name;
  document.getElementById('modalDesc').textContent = item.desc;
  document.getElementById('modalPrice').textContent = formatPrice(item.price);
  const avail = document.getElementById('modalAvail');
  avail.textContent = item.availableToday? '今日有货，欢迎下单':'今日售罄，暂不可下单';
  avail.className = 'avail-tag ' + (item.availableToday? 'avail-yes':'avail-no');
  modalAddCart.style.display = item.availableToday ? 'block' : 'none';
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}

function closeModal(){
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  currentModalItem = null;
}

function addToCart(item){
  cart.push({...item, note: ''});
  updateCart();
  renderList(menu);
  showCartToast(item.name + ' 已加入');
}

function removeOne(index){
  cart.splice(index,1);
  updateCart();
  renderList(menu);
}

function editNote(index){
  const item = cart[index];
  const note = prompt('添加备注（如：少辣、不加蒜、多放葱等）', item.note || '');
  if (note !== null) {
    item.note = note.trim();
    updateCart();
    renderList(menu);
  }
}

function updateCart(){
  cartCount.textContent = cart.length;
  cartCount.style.display = cart.length ? 'flex' : 'none';
  if (!cart.length) {
    cartItems.innerHTML = '';
    cartEmpty.style.display = 'block';
    orderBtn.disabled = true;
  } else {
    cartEmpty.style.display = 'none';
    orderBtn.disabled = false;
    const grouped = {};
    cart.forEach((item,i) => {
      if (!grouped[item.id]) grouped[item.id] = {item, indexes:[], qty:0};
      grouped[item.id].indexes.push(i);
      grouped[item.id].qty++;
    });
    cartItems.innerHTML = Object.values(grouped).map(g => {
      const lastIdx = g.indexes[g.indexes.length - 1];
      const note = g.item.note || '';
      return `
      <div class="cart-item">
        <img src="${g.item.img}" alt="${g.item.name}" onerror="this.src='images/default.svg'" />
        <div class="cart-item-info">
          <strong>${g.item.name}</strong>
          ${note ? '<span class="cart-note">📝 ' + note + '</span>' : ''}
          <span class="cart-note-btn" onclick="editNote(${lastIdx})">${note ? '修改备注' : '+ 添加备注'}</span>
        </div>
        <div class="cart-item-qty">
          <button onclick="removeOne(${lastIdx})">−</button>
          <span>${g.qty}</span>
          <button onclick="addToCart({id:${g.item.id},name:'${g.item.name.replace(/'/g,"\\'")}',price:${g.item.price},desc:'${(g.item.desc||'').replace(/'/g,"\\'")}',img:'${g.item.img}',availableToday:true,category:'${g.item.category||''}'})">+</button>
        </div>
      </div>
    `}).join('');
  }
  const total = cart.reduce((s,i)=>s+Number(i.price),0);
  cartTotal.textContent = formatPrice(total + Math.max(0, peopleCount-2) * 2);
}

function showCartToast(msg){
  let t = document.querySelector('.cart-toast');
  if (!t) { t = document.createElement('div'); t.className = 'cart-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'),1500);
}

function openCart(){ cartPanel.setAttribute('aria-hidden','false'); cartOverlay.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
function closeCart(){ cartPanel.setAttribute('aria-hidden','true'); cartOverlay.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }

async function submitOrder(){
  if (!cart.length) return;
  const items = cart.map(c=>{
    const i = { name: c.name, price: c.price };
    if (c.note) i.note = c.note;
    return i;
  });
  const subtotal = cart.reduce((s,i)=>s+Number(i.price),0);
  const extraFee = Math.max(0, peopleCount - 2) * 2;
  const total = subtotal + extraFee;

  // 保存订单到服务器
  let orderSaved = false;
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ people: peopleCount, items, subtotal, extraFee, total })
    });
    if (res.ok) orderSaved = true;
  } catch(e) { console.error('订单保存失败:', e); }

  cart = []; updateCart(); renderList(menu); closeCart();

  if (orderSaved) {
    showCartToast('下单成功！商家正在准备');
  } else {
    showCartToast('下单失败，请重试');
  }
}

async function loadConfig(){
  try { const r = await fetch('config.json?' + Date.now()); if(r.ok){ const c = await r.json(); paymentQR = c.paymentQR || ''; } } catch(e){}
}

async function loadMenu(){
  try {
    const res = await fetch('menu.json?' + Date.now());
    if (!res.ok) throw new Error('无法加载菜单');
    menu = await res.json();
    renderList(menu);
  } catch(e){ grid.innerHTML = '<div class="error">'+e.message+'</div>'; }
}

modalClose.addEventListener('click',closeModal);
modal.addEventListener('click',e=>{ if(e.target===modal) closeModal(); });
modalAddCart.addEventListener('click',()=>{ if (currentModalItem) { addToCart(currentModalItem); closeModal(); } });
cartBtn.addEventListener('click',openCart);
cartClose.addEventListener('click',closeCart);
cartOverlay.addEventListener('click',closeCart);
peopleMinus.addEventListener('click',()=>{ if(peopleCount>1){peopleCount--;peopleNum.textContent=peopleCount;updateCart();} });
peoplePlus.addEventListener('click',()=>{ if(peopleCount<20){peopleCount++;peopleNum.textContent=peopleCount;updateCart();} });
orderBtn.addEventListener('click',submitOrder);
payClose.addEventListener('click',()=>{ payModal.setAttribute('aria-hidden','true'); });
payModal.addEventListener('click',e=>{ if(e.target===payModal) payModal.setAttribute('aria-hidden','true'); });
search.addEventListener('input',e=>{
  const q = e.target.value.trim().toLowerCase();
  if (!q) return renderList(menu);
  renderList(menu.filter(i=> i.name.toLowerCase().includes(q) || String(i.price).includes(q) || (i.category||'').toLowerCase().includes(q)));
});

loadConfig();
loadMenu();
