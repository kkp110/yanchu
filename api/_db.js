// 云端 JSON 存储地址
const https = require('https');
const DB = {
  menu: 'https://jsonblob.com/api/jsonBlob/019e6c6d-f0c2-7f07-84c3-a57f9e1168e1',
  orders: 'https://jsonblob.com/api/jsonBlob/019e6c6d-f59c-7682-b8ed-dac67baeb0f7',
  config: 'https://jsonblob.com/api/jsonBlob/019e6c6d-f976-7b48-894b-66bef112dcda',
};

function fetchJSON(url, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, path: u.pathname, method: method || 'GET',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function readDB(key) { return await fetchJSON(DB[key], 'GET') || []; }
async function writeDB(key, data) { return await fetchJSON(DB[key], 'PUT', data); }

module.exports = { readDB, writeDB, DB };
