@echo off
chcp 65001 >nul
color 0A

echo ===========================================
echo   证件水印处理系统 - Docker 部署
echo ===========================================

:: ===========================================
:: 前置环境检查
:: ===========================================

echo.
echo 正在检查 Docker 环境...

:: 检查 Docker
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未安装
    echo.
    echo 请先安装 Docker:
    echo   下载: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

:: 检查 Docker 守护进程
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 守护进程未运行
    echo.
    echo 请启动 Docker Desktop
    echo.
    pause
    exit /b 1
)

echo [OK] Docker 已安装并运行

:: 检查 Docker Compose
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    set COMPOSE_CMD=docker compose
    echo [OK] docker compose 已安装
) else (
    where docker-compose >nul 2>&1
    if %errorlevel% equ 0 (
        set COMPOSE_CMD=docker-compose
        echo [OK] docker-compose 已安装
    ) else (
        echo [错误] Docker Compose 未安装
        pause
        exit /b 1
    )
)

:: ===========================================
:: 端口配置
:: ===========================================

echo.
echo 端口配置（直接回车使用默认值）:
echo.

set /p SERVER_PORT=后端 API 端口 [3000]:
if "%SERVER_PORT%"=="" set SERVER_PORT=3000

set /p CLIENT_PORT=前端 Web 端口 [8080]:
if "%CLIENT_PORT%"=="" set CLIENT_PORT=8080

:: 获取本机 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "ipv4" ^| findstr /v "127"') do (
    set SERVER_IP=%%a
    set SERVER_IP=!SERVER_IP: =!
    goto :done_ip
)
:done_ip
if not defined SERVER_IP set SERVER_IP=localhost

echo.
echo [1/4] 端口配置:
echo   - 后端 API: %SERVER_IP%:%SERVER_PORT%
echo   - 前端 Web:  http://%SERVER_IP%:%CLIENT_PORT%
echo.

:: ===========================================
:: 清理旧容器
:: ===========================================

echo [2/4] 清理旧容器和镜像...

%COMPOSE_CMD% down >nul 2>&1

docker rmi fastwm-server fastwm-client >nul 2>&1

echo   清理完成

:: ===========================================
:: 创建必要目录
:: ===========================================

echo [3/4] 创建必要目录...

if not exist "data\users" mkdir "data\users"
if not exist "data\documents" mkdir "data\documents"
if not exist "data\exports" mkdir "data\exports"
if not exist "data\backgrounds" mkdir "data\backgrounds"
if not exist "data\fonts" mkdir "data\fonts"
if not exist "fonts" mkdir "fonts"

echo   目录创建完成

:: ===========================================
:: 构建并启动
:: ===========================================

echo [4/4] 构建并启动 Docker 容器...

set SERVER_PORT=%SERVER_PORT%
set CLIENT_PORT=%CLIENT_PORT%
set JWT_SECRET=dev-only-secret-change-in-production

%COMPOSE_CMD% up -d --build

echo   等待服务启动...
timeout /t 10 /nobreak >nul

:: ===========================================
:: 状态检查
:: ===========================================

echo.
%COMPOSE_CMD% ps

echo.
echo ==========================================
echo   部署完成！
echo ==========================================
echo.
echo 访问地址: http://%SERVER_IP%:%CLIENT_PORT%
echo.
echo 常用命令:
echo   查看日志: %COMPOSE_CMD% logs -f
echo   停止服务: %COMPOSE_CMD% down
echo.
pause