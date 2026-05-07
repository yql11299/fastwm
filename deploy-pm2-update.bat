@echo off
chcp 65001 >nul
REM ===========================================
REM 证件水印处理系统 - PM2 快速更新脚本 (Windows)
REM 用于代码更新后重启服务，不重新安装依赖
REM ===========================================

cd /d %~dp0

echo ===========================================
echo   PM2 快速更新服务
echo ===========================================

echo.
echo 正在重启服务...

REM 重启后端
call pm2 restart fastwm-server 2>nul
if errorlevel 1 (
    echo   后端服务未运行，尝试启动...
    call pm2 start ecosystem.config.js --env production
)

REM 重启前端
call pm2 restart fastwm-client 2>nul

REM 等待一下
timeout /t 2 /nobreak >nul

REM 获取端口
set SERVER_PORT=3000
if exist "server\.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr "^PORT=" server\.env') do set SERVER_PORT=%%b
)

REM 显示状态
echo.
echo ===========================================
echo 服务状态:
echo ===========================================
call pm2 list

echo.
echo ===========================================
echo 访问地址:
echo ===========================================
echo   本机访问: http://localhost:5173
echo   后端 API: http://localhost:%SERVER_PORT%
echo.

echo 常用命令:
echo   查看日志:   pm2 logs
echo   查看状态:   pm2 list
echo   重启所有:   pm2 restart all
echo   停止所有:   pm2 stop all
echo.

pause
