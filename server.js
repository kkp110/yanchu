const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;
const MENU_FILE = path.join(ROOT, 'menu.json');
const ORDERS_FILE = path.join(ROOT, 'orders.json');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

function sendJSON(res, data, status = 200) {
  const body = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': body.length,
  });
  res.end(body);
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 - 页面未找到</h1>');
  }
}

function serveMenu(res) {
  try {
    const raw = fs.readFileSync(MENU_FILE, 'utf-8');
    const data = JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
    sendJSON(res, data);
  } catch (e) {
    sendJSON(res, [], 200);
  }
}

function saveMenu(req, res) {
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    try {
      const data = JSON.parse(Buffer.concat(body).toString('utf-8'));
      fs.writeFileSync(MENU_FILE, JSON.stringify(data, null, 2), 'utf-8');
      sendJSON(res, { ok: true, message: '菜单已保存' });
    } catch (e) {
      sendJSON(res, { ok: false, message: '保存失败: ' + e.message }, 400);
    }
  });
}

function uploadImage(req, res) {
  let chunks = [];
  let totalLen = 0;
  req.on('data', chunk => { totalLen += chunk.length; if (totalLen < 20*1024*1024) chunks.push(chunk); });
  req.on('end', () => {
    if (totalLen > 20*1024*1024) return sendJSON(res, { ok: false, message: '图片最大 20MB' }, 400);
    const buf = Buffer.concat(chunks);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    const filename = `${id}.jpg`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
    sendJSON(res, { ok: true, path: `uploads/${filename}` });
  });
}

function readJSON(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
  } catch (e) { return fallback; }
}

function serveConfig(res) { sendJSON(res, readJSON(CONFIG_FILE, { paymentQR: '' })); }

function saveConfig(req, res) {
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    try {
      const data = JSON.parse(Buffer.concat(body).toString('utf-8'));
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
      sendJSON(res, { ok: true, message: '设置已保存' });
    } catch (e) { sendJSON(res, { ok: false, message: '保存失败' }, 400); }
  });
}

const ARCHIVE_FILE = path.join(ROOT, 'orders_archive.json');

function getToday() { return new Date().toISOString().split('T')[0]; }

function serveOrders(res, query) {
  let orders = readJSON(ORDERS_FILE, []);
  const date = query?.date;
  if (date) orders = orders.filter(o => (o.date || '') === date);
  sendJSON(res, orders);
}

function autoArchive() {
  const today = getToday();
  const orders = readJSON(ORDERS_FILE, []);
  const oldOrders = orders.filter(o => o.date && o.date !== today);
  if (!oldOrders.length) return;
  const archive = readJSON(ARCHIVE_FILE, []);
  archive.unshift({ date: today, archivedAt: new Date().toLocaleString('zh-CN'), orders: oldOrders });
  // 只保留最近90天存档
  const recentArchive = archive.slice(0, 90);
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(recentArchive, null, 2), 'utf-8');
  const newOrders = orders.filter(o => o.date === today || !o.date);
  // 给没日期的旧订单补上今天日期
  newOrders.forEach(o => { if (!o.date) o.date = today; });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(newOrders, null, 2), 'utf-8');
}

function resetOrders(req, res) {
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    try {
      const data = JSON.parse(Buffer.concat(body).toString('utf-8'));
      const type = data.type || 'all';
      let orders = readJSON(ORDERS_FILE, []);
      if (type === 'cancelled') {
        // 只清除已取消的
        orders = orders.filter(o => o.status !== '已取消');
      } else if (type === 'done') {
        // 归档已完成的，保留待处理
        const archive = readJSON(ARCHIVE_FILE, []);
        const doneOrders = orders.filter(o => o.status === '已完成' || o.status === '已取消');
        if (doneOrders.length) {
          archive.unshift({ date: getToday(), archivedAt: new Date().toLocaleString('zh-CN'), orders: doneOrders });
          fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive.slice(0,90), null, 2), 'utf-8');
        }
        orders = orders.filter(o => o.status !== '已完成' && o.status !== '已取消');
      } else {
        // 归档所有
        const archive = readJSON(ARCHIVE_FILE, []);
        archive.unshift({ date: getToday(), archivedAt: new Date().toLocaleString('zh-CN'), orders: [...orders] });
        fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive.slice(0,90), null, 2), 'utf-8');
        orders = [];
      }
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
      sendJSON(res, { ok: true, message: '已清理', remaining: orders.length });
    } catch(e) { sendJSON(res, { ok: false, message: '操作失败' }, 400); }
  });
}

function saveOrder(req, res) {
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    try {
      const order = JSON.parse(Buffer.concat(body).toString('utf-8'));
      const orders = readJSON(ORDERS_FILE, []);
      order.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      order.time = new Date().toLocaleString('zh-CN');
      order.date = getToday();
      order.status = '已下单';
      // 每天的第一次下单时自动归档昨天数据
      autoArchive();
      orders.unshift(order);
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
      sendJSON(res, { ok: true, orderId: order.id, message: '下单成功' });
    } catch (e) { sendJSON(res, { ok: false, message: '下单失败' }, 400); }
  });
}

function updateOrder(req, res) {
  // URL: /api/orders/xxx?action=complete|cancel|delete
  const urlParts = req.url.split('/');
  const orderId = urlParts[urlParts.length - 1].split('?')[0];
  const action = (req.url.split('?')[1] || '').replace('action=', '');
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    try {
      const orders = readJSON(ORDERS_FILE, []);
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) return sendJSON(res, { ok: false, message: '订单不存在' }, 404);
      if (action === 'complete') orders[idx].status = '已完成';
      else if (action === 'cancel') orders[idx].status = '已取消';
      else if (action === 'delete') orders.splice(idx, 1);
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
      sendJSON(res, { ok: true, message: '操作成功' });
    } catch (e) { sendJSON(res, { ok: false, message: '操作失败' }, 400); }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = req.url.split('?')[0];

  if (url === '/api/menu' && req.method === 'GET') return serveMenu(res);
  if (url === '/api/menu' && req.method === 'POST') return saveMenu(req, res);
  if (url === '/api/upload' && req.method === 'POST') return uploadImage(req, res);
  if (url === '/api/config' && req.method === 'GET') return serveConfig(res);
  if (url === '/api/config' && req.method === 'POST') return saveConfig(req, res);
  // 归档必须在普通订单之前检查！
  if (url === '/api/orders' && req.method === 'GET' && (req.url.includes('archive') || req.url.includes('history'))) {
    sendJSON(res, readJSON(ARCHIVE_FILE, []));
    return;
  }
  if (url === '/api/orders' && req.method === 'GET') return serveOrders(res, { date: req.url.split('date=')[1]?.split('&')[0] });
  if (url === '/api/orders' && req.method === 'POST') return saveOrder(req, res);
  if (url === '/api/orders/reset' && req.method === 'POST') return resetOrders(req, res);
  if (url.startsWith('/api/orders/') && (req.method === 'POST' || req.method === 'PUT')) return updateOrder(req, res);

  // 静态文件
  let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
  serveStatic(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`焰厨服务器已启动: http://localhost:${PORT}`);
  console.log(`后台管理: http://localhost:${PORT}/admin.html`);
  console.log('按 Ctrl+C 停止');
});
