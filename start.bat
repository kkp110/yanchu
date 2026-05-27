@echo off
chcp 65001 >/dev/null
title 焰厨 - 菜单服务器

echo ============================
echo   焰厨菜单系统启动中...
echo ============================
echo.
echo 启动本地服务器...

start /B node server.js
timeout /t 2 /nobreak >/dev/null

echo 启动公网隧道...
start /B cloudflared.exe tunnel --url http://localhost:8000
timeout /t 5 /nobreak >/dev/null

echo.
echo ============================
echo   启动完成！
echo ============================
echo.
echo 本地访问:
echo   顾客菜单: http://localhost:8000
echo   后台管理: http://localhost:8000/admin.html
echo   扫码页面: http://localhost:8000/qrcode.html
echo.
echo 公网访问（Cloudflare 隧道）:
echo   请查看上方 cloudflared 输出的 https://xxx.trycloudflare.com 地址
echo.
echo 按任意键打开扫码页面...
pause >/dev/null
start http://localhost:8000/qrcode.html
echo.
echo 服务器运行中，关闭此窗口将停止服务。
pause >/dev/null
