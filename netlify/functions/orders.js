const { readDB, writeDB } = require('./_db.js');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod === 'GET') {
    const data = await readDB('orders');
    return { statusCode: 200, headers, body: JSON.stringify(data || []) };
  }
  if (event.httpMethod === 'POST') {
    try {
      const orders = (await readDB('orders')) || [];
      const order = JSON.parse(event.body);
      order.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      order.time = new Date().toLocaleString('zh-CN');
      order.status = '已下单';
      orders.unshift(order);
      await writeDB('orders', orders);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, orderId: order.id, message: '下单成功' }) };
    } catch(e) { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: e.message }) }; }
  }
  return { statusCode: 405, body: 'Method Not Allowed' };
};
