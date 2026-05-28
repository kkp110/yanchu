const { readDB, writeDB } = require('./_db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const data = await readDB('menu');
    return res.json(data || []);
  }
  if (req.method === 'POST') {
    try {
      await writeDB('menu', req.body);
      return res.json({ ok: true, message: '菜单已保存' });
    } catch(e) { return res.status(400).json({ ok: false, message: e.message }); }
  }
  res.status(405).end();
};
