@echo off
chcp 65001 >nul
color 0A

echo ===========================================
echo   证件水印处理系统 - PM2 部署
echo ===========================================

:: ===========================================
:: 前置环境检查
:: ===========================================

echo.
echo 正在检查环境...

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Node.js 未安装
    echo.
    echo 请先安装 Node.js 18+:
    echo   下载: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js 已安装 (%NODE_VERSION%)

:: 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] npm 未安装
    pause
    exit /b 1
)
echo [OK] npm 已安装

:: 检查 PM2
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] PM2 未安装，正在安装...
    npm install -g pm2
    if %errorlevel% neq 0 (
        echo [错误] PM2 安装失败
        pause
        exit /b 1
    )
    echo [OK] PM2 安装成功
) else (
    echo [OK] PM2 已安装
)

:: ===========================================
:: 端口配置
:: ===========================================

echo.
echo 端口配置（直接回车使用默认值）:
echo.

set /p SERVER_PORT=后端 API 端口 [3000]:
if "%SERVER_PORT%"=="" set SERVER_PORT=3000

set /p CLIENT_PORT=前端 Web 端口 [5173]:
if "%CLIENT_PORT%"=="" set CLIENT_PORT=5173

:: 获取本机 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "ipv4" ^| findstr /v "127"') do (
    set SERVER_IP=%%a
    set SERVER_IP=!SERVER_IP: =!
    goto :done_ip
)
:done_ip
if not defined SERVER_IP set SERVER_IP=localhost

echo.
echo [1/6] 端口配置:
echo   - 后端 API: %SERVER_IP%:%SERVER_PORT%
echo   - 前端 Web:  http://%SERVER_IP%:%CLIENT_PORT%
echo.

:: ===========================================
:: 清理旧构建产物
:: ===========================================

echo [2/6] 清理旧构建产物...

:: 停止旧 PM2 进程
pm2 stop all >nul 2>&1
pm2 delete all >nul 2>&1

:: 清理 node_modules
if exist "server\node_modules" (
    echo   清理后端 node_modules...
    rd /s /q "server\node_modules" 2>nul
)

if exist "client\node_modules" (
    echo   清理前端 node_modules...
    rd /s /q "client\node_modules" 2>nul
)

if exist "client\dist" (
    echo   清理前端构建产物...
    rd /s /q "client\dist" 2>nul
)

:: 清理日志
if exist "logs" (
    del /q "logs\*.log" 2>nul
)

echo   清理完成

:: ===========================================
:: 创建必要目录
:: ===========================================

echo [3/6] 创建必要目录...

if not exist "data\users" mkdir "data\users"
if not exist "data\documents" mkdir "data\documents"
if not exist "data\exports" mkdir "data\exports"
if not exist "data\backgrounds" mkdir "data\backgrounds"
if not exist "data\fonts" mkdir "data\fonts"
if not exist "logs" mkdir "logs"
if not exist "fonts" mkdir "fonts"

echo   目录创建完成

:: ===========================================
:: 安装后端依赖
:: ===========================================

echo [4/6] 安装后端依赖...

cd /d "%~dp0server"
call npm install --production
if %errorlevel% neq 0 (
    echo [错误] 后端依赖安装失败
    pause
    exit /b 1
)
echo   后端依赖安装完成

:: ===========================================
:: 安装前端依赖并构建
:: ===========================================

echo [5/6] 安装前端依赖并构建...

cd /d "%~dp0client"
if not exist "node_modules" (
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
    echo   前端依赖安装完成
)

call npm run build
if %errorlevel% neq 0 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)
echo   前端构建完成

:: ===========================================
:: 环境变量配置
:: ===========================================

echo [6/6] 配置环境变量并启动服务...

cd /d "%~dp0"

if not exist "server\.env" (
    if exist "server\.env.example" (
        copy "server\.env.example" "server\.env" >nul
        echo   [提示] 已创建 server/.env
    )
)

:: 检查 JWT_SECRET
findstr /C:"JWT_SECRET=dev-only" "server\.env" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [警告] JWT_SECRET 使用默认值，生产环境请修改
)

:: 启动服务
cd /d "%~dp0"
start cmd /k "pm2 start ecosystem.config.js"

timeout /t 3 /nobreak >nul

pm2 save >nul 2>&1

:: ===========================================
:: 状态检查
:: ===========================================

echo.
echo ==========================================
echo   部署完成！
echo ==========================================
echo.
echo 访问地址: http://%SERVER_IP%:%CLIENT_PORT%
echo.
echo 注意：PM2 服务已在后台运行
echo.
echo 常用命令:
echo   查看日志: pm2 logs
echo   查看状态: pm2 list
echo   重启服务: pm2 restart all
echo.
pause