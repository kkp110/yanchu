let menu = [];
let cart = [];
let peopleCount = 2;
let paymentQR = '';

const grid = document.getElementById('menuGrid');
const search = document.getElementById('search');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const qrCanvas = document.getElementById('qrCode');

// 购物车相关
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

// 支付
const payModal = document.getElementById('payModal');
const payClose = document.getElementById('payClose');
const payAmount = document.getElementById('payAmount');
const payQR = document.getElementById('payQR');

// 弹窗中的加购按钮
const modalAddCart = document.getElementById('modalAddCart');
let currentModalItem = null;

function formatPrice(n){return '￥' + Number(n).toFixed(2)}

// ========== 加载数据 ==========

async function loadConfig(){
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const cfg = await res.json();
      paymentQR = cfg.paymentQR || '';
    }
  } catch(e){}
}

async function loadMenu(){
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('无法加载菜单数据');
    menu = await res.json();
    renderList(menu);
    initQRCode();
  } catch (error) {
    grid.innerHTML = `<div class="error">${error.message}</div>`;
    console.error(error);
  }
}

// ========== 菜单渲染 ==========

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
      <div class="card-img-wrap">
        <img src="${item.img}" alt="${item.name}" loading="lazy" onerror="this.src='images/default.svg'" />
        <span class="card-badge ${item.availableToday? 'badge-on':'badge-off'}">${item.availableToday? '今日有货':'今日售罄'}</span>
        ${inCart ? '<span class="cart-tag">已选×'+inCart+'</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-header">
          <h3>${item.name}</h3>
          <span class="card-cat">${item.category||''}</span>
        </div>
        <p class="card-desc">${item.desc || ''}</p>
        <div class="card-price">${formatPrice(item.price)}</div>
      </div>
    `;
    card.addEventListener('click',()=>openModal(item));
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

// ========== 购物车 =====....=====

function addToCart(item){
  cart.push({...item});
  updateCart();
  renderList(menu);
  showCartToast(item.name + ' 已加入购物车');
}

function removeFromCart(index){
  cart.splice(index,1);
  updateCart();
  renderList(menu);
}

function updateCart(){
  // 数量角标
  cartCount.textContent = cart.length;
  cartCount.style.display = cart.length ? 'flex' : 'none';

  // 列表
  if (!cart.length) {
    cartItems.innerHTML = '';
    cartEmpty.style.display = 'block';
    orderBtn.disabled = true;
  } else {
    cartEmpty.style.display = 'none';
    orderBtn.disabled = false;
    // 按菜品分组
    const grouped = {};
    cart.forEach((item,i) => {
      if (!grouped[item.id]) grouped[item.id] = {item, indexes:[], qty:0};
      grouped[item.id].indexes.push(i);
      grouped[item.id].qty++;
    });
    cartItems.innerHTML = Object.values(grouped).map(g => `
      <div class="cart-item">
        <img src="${g.item.img}" alt="${g.item.name}" onerror="this.src='images/default.svg'" />
        <div class="cart-item-info">
          <strong>${g.item.name}</strong>
          <span>${formatPrice(g.item.price)} × ${g.qty}</span>
        </div>
        <div class="cart-item-qty">
          <button onclick="removeOne(${g.indexes[g.indexes.length-1]})">−</button>
          <span>${g.qty}</span>
          <button onclick="addToCart({id:${g.item.id},name:'${g.item.name.replace(/'/g,"\\'")}',price:${g.item.price},desc:'${(g.item.desc||'').replace(/'/g,"\\'")}',img:'${g.item.img}',availableToday:true,category:'${g.item.category||''}'})">+</button>
        </div>
      </div>
    `).join('');
  }

  // 总价
  const total = cart.reduce((s,i)=>s+Number(i.price),0);
  cartTotal.textContent = formatPrice(total + Math.max(0, peopleCount-2) * 2); // 超2人每位加2元餐位费
}

function removeOne(index){
  cart.splice(index,1);
  updateCart();
  renderList(menu);
}

function showCartToast(msg){
  let t = document.querySelector('.cart-toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'cart-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(()=>t.classList.remove('show'),1500);
}

// ========== 购物车面板开关 ==========

function openCart(){
  cartPanel.setAttribute('aria-hidden','false');
  cartOverlay.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}
function closeCart(){
  cartPanel.setAttribute('aria-hidden','true');
  cartOverlay.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

// ========== 下单 ==========

async function submitOrder(){
  if (!cart.length) return;
  const items = cart.map(c=>({name:c.name,price:c.price}));
  const subtotal = cart.reduce((s,i)=>s+Number(i.price),0);
  const extraFee = Math.max(0, peopleCount - 2) * 2;
  const total = subtotal + extraFee;

  try {
    const res = await fetch('/api/orders',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        people: peopleCount,
        items: items,
        subtotal: subtotal,
        extraFee: extraFee,
        total: total
      })
    });
    const result = await res.json();
    if (result.ok) {
      // 清空购物车
      cart = [];
      updateCart();
      renderList(menu);
      closeCart();
      // 显示支付弹窗
      payAmount.textContent = '请支付 ' + formatPrice(total) + '（'+peopleCount+'人就餐）';
      if (paymentQR) {
        payQR.src = paymentQR;
        payQR.style.display = 'block';
      } else {
        payQR.style.display = 'none';
      }
      payModal.setAttribute('aria-hidden','false');
    } else {
      alert('下单失败：' + (result.message||'请重试'));
    }
  } catch(e){
    alert('下单失败：' + e.message);
  }
}

// ========== 事件绑定 ==========

modalClose.addEventListener('click',closeModal);
modal.addEventListener('click',e=>{ if(e.target===modal) closeModal(); });

modalAddCart.addEventListener('click',()=>{
  if (currentModalItem) { addToCart(currentModalItem); closeModal(); }
});

cartBtn.addEventListener('click',openCart);
cartClose.addEventListener('click',closeCart);
cartOverlay.addEventListener('click',closeCart);

peopleMinus.addEventListener('click',()=>{
  if (peopleCount > 1) { peopleCount--; peopleNum.textContent = peopleCount; updateCart(); }
});
peoplePlus.addEventListener('click',()=>{
  if (peopleCount < 20) { peopleCount++; peopleNum.textContent = peopleCount; updateCart(); }
});

orderBtn.addEventListener('click',submitOrder);

payClose.addEventListener('click',()=>{
  payModal.setAttribute('aria-hidden','true');
});
payModal.addEventListener('click',e=>{ if(e.target===payModal) payModal.setAttribute('aria-hidden','true'); });

search.addEventListener('input',e=>{
  const q = e.target.value.trim().toLowerCase();
  if (!q) return renderList(menu);
  const filtered = menu.filter(i=>
    i.name.toLowerCase().includes(q) ||
    String(i.price).includes(q) ||
    (i.category||'').toLowerCase().includes(q)
  );
  renderList(filtered);
});

function initQRCode(){
  if (!window.QRCode) return;
  const url = window.location.href;
  QRCode.toCanvas(qrCanvas, url, {
    width: 200,
    color: { dark: '#c82712', light: '#ffffff' }
  }, err => err && console.error(err));
}

// ========== 启动 ==========
loadConfig();
loadMenu();
