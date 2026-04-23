#!/bin/bash
# ===========================================
# 证件水印处理系统 - PM2 部署脚本
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"

printf '%b===========================================%b\n' "$GREEN" "$NC"
printf '%b  证件水印处理系统 - PM2 部署%b\n' "$GREEN" "$NC"
printf '%b===========================================%b\n' "$GREEN" "$NC"

# ===========================================
# 前置环境检查
# ===========================================

printf '\n%b正在检查环境...%b\n\n' "$CYAN" "$NC"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    printf '%b✗ Node.js 未安装%b\n' "$RED" "$NC"
    printf '\n%b请先安装 Node.js 18+:%b\n' "$YELLOW" "$NC"
    printf '\n  Ubuntu/Debian:\n'
    printf '    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n'
    printf '    sudo apt-get install -y nodejs\n'
    printf '\n  CentOS/RHEL:\n'
    printf '    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -\n'
    printf '    sudo yum install -y nodejs\n'
    printf '\n  macOS:\n'
    printf '    brew install node@20\n'
    printf '\n  Windows:\n'
    printf '    下载 https://nodejs.org/\n'
    printf '\n'
    exit 1
fi

NODE_VERSION=$(node -v)
printf '%b✓ Node.js 已安装 (%s)%b\n' "$GREEN" "$NODE_VERSION" "$NC"

# 检查 npm
if ! command -v npm &> /dev/null; then
    printf '%b✗ npm 未安装%b\n' "$RED" "$NC"
    exit 1
fi
printf '%b✓ npm 已安装%b\n' "$GREEN" "$NC"

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    printf '%b✗ PM2 未安装，正在安装...%b\n' "$YELLOW" "$NC"
    npm install -g pm2
    if command -v pm2 &> /dev/null; then
        printf '%b✓ PM2 安装成功%b\n' "$GREEN" "$NC"
    else
        printf '%b✗ PM2 安装失败%b\n' "$RED" "$NC"
        exit 1
    fi
else
    printf '%b✓ PM2 已安装%b\n' "$GREEN" "$NC"
fi

printf '\n'

# ===========================================
# 端口配置
# ===========================================

printf '%b端口配置（直接回车使用默认值）:%b\n' "$CYAN" "$NC"
printf '\n'

printf '后端 API 端口 [%b3000%b]: ' "$YELLOW" "$NC"
read SERVER_PORT
SERVER_PORT=${SERVER_PORT:-3000}

printf '前端 Web 端口 [%b5173%b]: ' "$YELLOW" "$NC"
read CLIENT_PORT
CLIENT_PORT=${CLIENT_PORT:-5173}

if command -v hostname &> /dev/null; then
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
else
    SERVER_IP="localhost"
fi

printf '\n'
printf '%b[1/6] 端口配置:%b\n' "$GREEN" "$NC"
printf '  - 后端 API: %s:%s\n' "$SERVER_IP" "$SERVER_PORT"
printf '  - 前端 Web:  http://%s:%s\n' "$SERVER_IP" "$CLIENT_PORT"
printf '\n'

# ===========================================
# 清理旧构建产物
# ===========================================

printf '%b[2/6] 清理旧构建产物...%b\n' "$GREEN" "$NC"

# 停止旧 PM2 进程
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# 清理 node_modules 和 dist
if [ -d "$PROJECT_ROOT/server/node_modules" ]; then
    printf '  清理后端 node_modules...\n'
    rm -rf "$PROJECT_ROOT/server/node_modules"
fi

if [ -d "$PROJECT_ROOT/client/node_modules" ]; then
    printf '  清理前端 node_modules...\n'
    rm -rf "$PROJECT_ROOT/client/node_modules"
fi

if [ -d "$PROJECT_ROOT/client/dist" ]; then
    printf '  清理前端构建产物...\n'
    rm -rf "$PROJECT_ROOT/client/dist"
fi

# 清理日志
if [ -d "$PROJECT_ROOT/logs" ]; then
    printf '  清理日志文件...\n'
    rm -f "$PROJECT_ROOT/logs"/*.log 2>/dev/null || true
fi

printf '  清理完成\n'

# ===========================================
# 创建必要目录
# ===========================================

printf '%b[3/6] 创建必要目录...%b\n' "$GREEN" "$NC"
mkdir -p "$PROJECT_ROOT/data/users"
mkdir -p "$PROJECT_ROOT/data/documents"
mkdir -p "$PROJECT_ROOT/data/exports"
mkdir -p "$PROJECT_ROOT/data/backgrounds"
mkdir -p "$PROJECT_ROOT/data/fonts"
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$PROJECT_ROOT/fonts"
touch "$PROJECT_ROOT/data/users/.gitkeep" 2>/dev/null || true
touch "$PROJECT_ROOT/data/documents/.gitkeep" 2>/dev/null || true
touch "$PROJECT_ROOT/data/exports/.gitkeep" 2>/dev/null || true
touch "$PROJECT_ROOT/data/backgrounds/.gitkeep" 2>/dev/null || true
printf '  目录创建完成\n'

# ===========================================
# 安装后端依赖
# ===========================================

printf '%b[4/6] 安装后端依赖...%b\n' "$GREEN" "$NC"

cd "$PROJECT_ROOT/server"
if npm install --production 2>&1 | tee /tmp/npm-install-server.log; then
    printf '  后端依赖安装完成\n'
else
    printf '%b✗ 后端依赖安装失败%b\n' "$RED" "$NC"
    printf '  查看日志: /tmp/npm-install-server.log\n'
    exit 1
fi

# ===========================================
# 安装前端依赖并构建
# ===========================================

printf '%b[5/6] 安装前端依赖并构建...%b\n' "$GREEN" "$NC"

cd "$PROJECT_ROOT/client"
if [ ! -d "node_modules" ]; then
    if npm install 2>&1 | tee /tmp/npm-install-client.log; then
        printf '  前端依赖安装完成\n'
    else
        printf '%b✗ 前端依赖安装失败%b\n' "$RED" "$NC"
        printf '  查看日志: /tmp/npm-install-client.log\n'
        exit 1
    fi
else
    printf '  前端依赖已存在，跳过安装\n'
fi

if npm run build 2>&1 | tee /tmp/npm-build-client.log; then
    printf '  前端构建完成\n'
else
    printf '%b✗ 前端构建失败%b\n' "$RED" "$NC"
    printf '  查看日志: /tmp/npm-build-client.log\n'
    exit 1
fi

# ===========================================
# 环境变量配置
# ===========================================

printf '%b[6/6] 配置环境变量并启动服务...%b\n' "$GREEN" "$NC"

cd "$PROJECT_ROOT"

if [ ! -f "server/.env" ]; then
    if [ -f "server/.env.example" ]; then
        cp "server/.env.example" "server/.env"
        printf '  %b已创建 server/.env%b\n' "$YELLOW" "$NC"
    fi
fi

# 修改端口配置
if [ -f "server/.env" ]; then
    sed -i.bak "s/^PORT=.*/PORT=$SERVER_PORT/" "server/.env" 2>/dev/null || \
    sed -i '' "s/^PORT=.*/PORT=$SERVER_PORT/" "server/.env" 2>/dev/null || true
    rm -f "server/.env.bak" 2>/dev/null || true
fi

# 检查 JWT_SECRET
if grep -q "JWT_SECRET=dev-only" "server/.env" 2>/dev/null || \
   grep -q "JWT_SECRET=your-secret" "server/.env" 2>/dev/null; then
    printf '  %b警告: JWT_SECRET 使用默认值，生产环境请修改%b\n' "$YELLOW" "$NC"
fi

# 启动服务
PORT=$SERVER_PORT pm2 start ecosystem.config.js

# 等待服务启动
sleep 3

# 保存进程列表
pm2 save 2>/dev/null || true

# 设置开机自启
pm2 startup 2>/dev/null || true

# ===========================================
# 状态检查
# ===========================================

printf '\n'
if pm2 list | grep -q "online"; then
    printf '%b===========================================%b\n' "$GREEN" "$NC"
    printf '%b  部署成功！%b\n' "$GREEN" "$NC"
    printf '%b===========================================%b\n' "$GREEN" "$NC"
    printf '\n'
    printf '访问地址: %bhttp://%s:%s%b\n' "$CYAN" "$SERVER_IP" "$CLIENT_PORT" "$NC"
    printf '\n'
    printf '%b常用命令:%b\n' "$YELLOW" "$NC"
    printf '  查看日志:   pm2 logs\n'
    printf '  查看状态:   pm2 list\n'
    printf '  重启服务:   pm2 restart all\n'
    printf '  停止服务:   pm2 stop all\n'
    printf '\n'
else
    printf '%b部署可能有问题，请检查:%b\n' "$YELLOW" "$NC"
    pm2 list
    printf '\n详细日志: pm2 logs\n'
fi