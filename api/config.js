const { readDB, writeDB } = require('./_db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const cfg = await readDB('config');
    return res.json(cfg || { paymentQR: '' });
  }
  if (req.method === 'POST') {
    try {
      await writeDB('config', req.body);
      return res.json({ ok: true, message: '设置已保存' });
    } catch(e) { return res.status(400).json({ ok: false, message: e.message }); }
  }
  res.status(405).end();
};
