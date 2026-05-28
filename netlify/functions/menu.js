const { readDB, writeDB } = require('./_db.js');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod === 'GET') {
    const data = await readDB('menu');
    return { statusCode: 200, headers, body: JSON.stringify(data || []) };
  }
  if (event.httpMethod === 'POST') {
    try {
      await writeDB('menu', JSON.parse(event.body));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: '菜单已保存' }) };
    } catch(e) { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: e.message }) }; }
  }
  return { statusCode: 405, body: 'Method Not Allowed' };
};
