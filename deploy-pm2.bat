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
    call npm install -g pm2
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
:: 配置 npm 镜像
:: ===========================================

echo.
echo 正在配置 npm 镜像...

call npm config get registry >nul 2>&1
set "NPM_REGISTRY="
for /f "tokens=*" %%i in ('npm config get registry 2^>nul') do set "NPM_REGISTRY=%%i"
echo 当前镜像: %NPM_REGISTRY%

echo 设置 npm 镜像为国内镜像...
call npm config set registry https://registry.npmmirror.com
echo [OK] npm 镜像配置完成

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

:: 清理 package-lock.json
if exist "server\package-lock.json" del /f /q "server\package-lock.json"
if exist "client\package-lock.json" del /f /q "client\package-lock.json"

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
echo   执行 npm install --prefer-offline --no-audit...

call npm install --prefer-offline --no-audit --loglevel=error
if %errorlevel% neq 0 (
    echo [提示] npm install 失败，尝试备用方案...
    call npm install --force --prefer-offline --no-audit --loglevel=error
    if %errorlevel% neq 0 (
        echo [错误] 后端依赖安装失败
        echo   请手动运行: cd server ^&^& npm install
        pause
        exit /b 1
    )
)
echo   后端依赖安装完成

:: ===========================================
:: 安装前端依赖并构建
:: ===========================================

echo [5/6] 安装前端依赖并构建...

cd /d "%~dp0client"
if not exist "node_modules" (
    echo   执行 npm install --prefer-offline --no-audit...
    call npm install --prefer-offline --no-audit --loglevel=error
    if %errorlevel% neq 0 (
        echo [提示] npm install 失败，尝试备用方案...
        call npm install --force --prefer-offline --no-audit --loglevel=error
        if %errorlevel% neq 0 (
            echo [错误] 前端依赖安装失败
            pause
            exit /b 1
        )
    )
    echo   前端依赖安装完成
)

echo   执行 npm run build...

:: 检测 WSL IP（如果服务在 WSL 中运行）
set "WSL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "vEthernet" ^| findstr /i "172"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        if not defined WSL_IP set "WSL_IP=%%b"
    )
)

if not defined WSL_IP set "WSL_IP=172.17.0.1"

echo   检测到 WSL IP: %WSL_IP%
echo   后端 API 地址: http://%WSL_IP%:%SERVER_PORT%/api

:: 构建前端，指定后端 API 地址
set "VITE_API_URL=http://%WSL_IP%:%SERVER_PORT%/api"
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
call pm2 start ecosystem.config.js

timeout /t 3 /nobreak >nul

call pm2 save >nul 2>&1

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