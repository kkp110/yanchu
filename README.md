# 焰厨 — 在线菜单系统

可自主管理菜品的餐厅菜单网页，支持微信扫码浏览。

## 运行方式

在项目目录运行任一命令：

```bash
# 方式一：Node.js（推荐）
node server.js

# 方式二：Python
& 'C:\Program Files\Python311\python.exe' server.py
```

然后访问：
- 顾客菜单页面：`http://localhost:8000`
- 后台管理页面：`http://localhost:8000/admin.html`

## 后台管理（admin.html + admin.js）

打开后台页面后可以：
- **添加菜品**：填写菜名、价格、分类、描述，上传图片
- **编辑菜品**：点击"编辑"按钮，修改后提交
- **删除菜品**：点击"删除"按钮
- 所有修改会通过 API 保存到 `menu.json`，顾客页面自动更新

## 微信扫码

1. 将项目部署到公网（推荐免费方案）：
   - **GitHub Pages**：上传到 GitHub，开启 Pages
   - **Vercel**：`npx vercel` 一键部署
   - **Netlify**：拖拽文件夹即可
   - **ngrok**：`ngrok http 8000` 生成本地隧道
2. 顾客菜单页面底部会自动生成二维码
3. 顾客用微信扫一扫即可打开菜单

在同一局域网下，手机也可以直接访问电脑 IP 地址，例如 `http://192.168.1.100:8000`。

## 项目文件

- `index.html` — 顾客菜单页面
- `admin.html` — 后台管理页面
- `app.js` — 菜单展示逻辑
- `admin.js` — 后台管理逻辑
- `server.js` — Node.js 后端（推荐）
- `server.py` — Python 后端（备选）
- `styles.css` — 全局样式
- `menu.json` — 菜品数据
- `images/` — 菜品图片
