const { readDB, writeDB } = require('./_db.js');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod === 'GET') {
    const cfg = await readDB('config');
    return { statusCode: 200, headers, body: JSON.stringify(cfg || { paymentQR: '' }) };
  }
  if (event.httpMethod === 'POST') {
    try {
      await writeDB('config', JSON.parse(event.body));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: '设置已保存' }) };
    } catch(e) { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: e.message }) }; }
  }
  return { statusCode: 405, body: 'Method Not Allowed' };
};
