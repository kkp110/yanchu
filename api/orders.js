const { readDB, writeDB } = require('./_db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const data = await readDB('orders');
    return res.json(data || []);
  }
  if (req.method === 'POST') {
    try {
      const orders = (await readDB('orders')) || [];
      const order = req.body;
      order.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      order.time = new Date().toLocaleString('zh-CN');
      order.status = '已下单';
      orders.unshift(order);
      await writeDB('orders', orders);
      return res.json({ ok: true, orderId: order.id, message: '下单成功' });
    } catch(e) { return res.status(400).json({ ok: false, message: e.message }); }
  }
  res.status(405).end();
};
