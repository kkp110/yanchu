// 通过 GitHub API 读写仓库中的 JSON 文件
const https = require('https');
const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = 'kkp110/yanchu';

function githubAPI(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: '/repos/' + REPO + '/contents/' + path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'User-Agent': 'yanchu',
        'Accept': 'application/vnd.github+json'
      }
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

async function readDB(key) {
  const file = key + '.json';
  const info = await githubAPI('GET', file);
  if (info && info.content) {
    return JSON.parse(Buffer.from(info.content, 'base64').toString('utf-8'));
  }
  return key === 'orders' ? [] : (key === 'config' ? { paymentQR: '' } : []);
}

async function writeDB(key, data) {
  const file = key + '.json';
  // 先获取当前 SHA
  const info = await githubAPI('GET', file);
  const sha = info?.sha;
  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');
  return await githubAPI('PUT', file, { message: 'update ' + file, content, sha });
}

module.exports = { readDB, writeDB };
