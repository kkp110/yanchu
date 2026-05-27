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
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const id = Math.random().toString(36).slice(2, 10);
    const filename = `${id}.png`;
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

function serveOrders(res) { sendJSON(res, readJSON(ORDERS_FILE, [])); }

function saveOrder(req, res) {
  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    try {
      const order = JSON.parse(Buffer.concat(body).toString('utf-8'));
      const orders = readJSON(ORDERS_FILE, []);
      order.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      order.time = new Date().toLocaleString('zh-CN');
      order.status = '已下单';
      orders.unshift(order);
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
      sendJSON(res, { ok: true, orderId: order.id, message: '下单成功' });
    } catch (e) { sendJSON(res, { ok: false, message: '下单失败' }, 400); }
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
  if (url === '/api/orders' && req.method === 'GET') return serveOrders(res);
  if (url === '/api/orders' && req.method === 'POST') return saveOrder(req, res);

  // 静态文件
  let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
  serveStatic(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`焰厨服务器已启动: http://localhost:${PORT}`);
  console.log(`后台管理: http://localhost:${PORT}/admin.html`);
  console.log('按 Ctrl+C 停止');
});
