@echo off
chcp 65001 >nul
color 0A

echo ===========================================
echo   证件水印处理系统 - Node.js 原生部署
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
echo [1/5] 端口配置:
echo   - 后端 API: %SERVER_IP%:%SERVER_PORT%
echo   - 前端 Web:  http://%SERVER_IP%:%CLIENT_PORT%
echo.

:: ===========================================
:: 清理旧构建产物
:: ===========================================

echo [2/5] 清理旧构建产物...

if exist "client\dist" (
    echo   清理前端构建产物...
    rd /s /q "client\dist" 2>nul
)

echo   清理完成

:: ===========================================
:: 创建必要目录
:: ===========================================

echo [3/5] 创建必要目录...

if not exist "data\users" mkdir "data\users"
if not exist "data\documents" mkdir "data\documents"
if not exist "data\exports" mkdir "data\exports"
if not exist "data\backgrounds" mkdir "data\backgrounds"
if not exist "data\fonts" mkdir "data\fonts"
if not exist "fonts" mkdir "fonts"

echo   目录创建完成

:: ===========================================
:: 安装依赖并构建
:: ===========================================

echo [4/5] 安装依赖并构建...

:: 安装后端依赖
cd /d "%~dp0server"
if not exist "node_modules" (
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 后端依赖安装失败
        pause
        exit /b 1
    )
    echo   后端依赖安装完成
)

:: 安装前端依赖并构建
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

echo   后端 API 地址: http://%SERVER_IP%:%SERVER_PORT%/api
set "VITE_API_URL=http://%SERVER_IP%:%SERVER_PORT%/api"
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

echo [5/5] 配置环境变量...

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

:: ===========================================
:: 启动服务
:: ===========================================

echo.
echo ==========================================
echo   部署完成！
echo ==========================================
echo.
echo 请在两个终端中分别运行：
echo.
echo [终端 1 - 启动后端]
echo   cd %CD%
echo   cd server
echo   npm start
echo.
echo [终端 2 - 启动前端]
echo   cd %CD%
echo   cd client
echo   npm run dev
echo.
echo 或使用 Vite 生产模式：
echo   cd client
echo   npx vite preview --port %CLIENT_PORT%
echo.
echo 访问地址: http://%SERVER_IP%:%CLIENT_PORT%
echo.
echo [警告] 原生部署需要保持终端开启
echo   推荐使用 PM2 部署以获得进程管理
echo.
pause