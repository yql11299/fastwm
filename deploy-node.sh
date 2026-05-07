#!/bin/bash
# ===========================================
# 证件水印处理系统 - Node.js 原生部署脚本
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
printf '%b  证件水印处理系统 - Node.js 原生部署%b\n' "$GREEN" "$NC"
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
printf '%b[1/5] 端口配置:%b\n' "$GREEN" "$NC"
printf '  - 后端 API: %s:%s\n' "$SERVER_IP" "$SERVER_PORT"
printf '  - 前端 Web:  http://%s:%s\n' "$SERVER_IP" "$CLIENT_PORT"
printf '\n'

# ===========================================
# 清理旧构建产物
# ===========================================

printf '%b[2/5] 清理旧构建产物...%b\n' "$GREEN" "$NC"

# 清理前端构建产物
if [ -d "$PROJECT_ROOT/client/dist" ]; then
    printf '  清理前端构建产物...\n'
    rm -rf "$PROJECT_ROOT/client/dist"
fi

# 清理 node_modules（可选，注释掉以加快安装速度）
# rm -rf "$PROJECT_ROOT/server/node_modules"
# rm -rf "$PROJECT_ROOT/client/node_modules"

printf '  清理完成\n'

# ===========================================
# 创建必要目录
# ===========================================

printf '%b[3/5] 创建必要目录...%b\n' "$GREEN" "$NC"
mkdir -p "$PROJECT_ROOT/data/users"
mkdir -p "$PROJECT_ROOT/data/documents"
mkdir -p "$PROJECT_ROOT/data/exports"
mkdir -p "$PROJECT_ROOT/data/backgrounds"
mkdir -p "$PROJECT_ROOT/data/fonts"
mkdir -p "$PROJECT_ROOT/fonts"
touch "$PROJECT_ROOT/data/users/.gitkeep" 2>/dev/null || true
touch "$PROJECT_ROOT/data/documents/.gitkeep" 2>/dev/null || true
touch "$PROJECT_ROOT/data/exports/.gitkeep" 2>/dev/null || true
touch "$PROJECT_ROOT/data/backgrounds/.gitkeep" 2>/dev/null || true
printf '  目录创建完成\n'

# ===========================================
# 安装后端依赖
# ===========================================

printf '%b[4/5] 安装依赖并构建...%b\n' "$GREEN" "$NC"

# 安装后端依赖
cd "$PROJECT_ROOT/server"
if [ ! -d "node_modules" ]; then
    printf '  安装后端依赖...\n'
    if npm install 2>&1 | tee /tmp/npm-install-server.log; then
        printf '  后端依赖安装完成\n'
    else
        printf '%b✗ 后端依赖安装失败%b\n' "$RED" "$NC"
        printf '  查看日志: /tmp/npm-install-server.log\n'
        exit 1
    fi
else
    printf '  后端依赖已存在，跳过\n'
fi

# 安装前端依赖并构建
cd "$PROJECT_ROOT/client"
if [ ! -d "node_modules" ]; then
    printf '  安装前端依赖...\n'
    if npm install 2>&1 | tee /tmp/npm-install-client.log; then
        printf '  前端依赖安装完成\n'
    else
        printf '%b✗ 前端依赖安装失败%b\n' "$RED" "$NC"
        printf '  查看日志: /tmp/npm-install-client.log\n'
        exit 1
    fi
else
    printf '  前端依赖已存在，跳过\n'
fi

printf '  构建前端...\n'
printf '  后端 API 地址: http://%s:%s/api\n' "$SERVER_IP" "$SERVER_PORT"
if VITE_API_URL="http://${SERVER_IP}:${SERVER_PORT}/api" npm run build 2>&1 | tee /tmp/npm-build-client.log; then
    printf '  前端构建完成\n'
else
    printf '%b✗ 前端构建失败%b\n' "$RED" "$NC"
    printf '  查看日志: /tmp/npm-build-client.log\n'
    exit 1
fi

# ===========================================
# 环境变量配置
# ===========================================

printf '%b[5/5] 配置环境变量...%b\n' "$GREEN" "$NC"

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

# ===========================================
# 启动服务
# ===========================================

printf '\n'
printf '%b===========================================%b\n' "$GREEN" "$NC"
printf '%b  部署完成！%b\n' "$GREEN" "$NC"
printf '%b===========================================%b\n' "$GREEN" "$NC"
printf '\n'
printf '请在两个终端中分别运行：\n'
printf '\n'
printf '%b终端 1 - 启动后端:%b\n' "$CYAN" "$NC"
printf '  cd %s\n' "$PROJECT_ROOT"
printf '  cd server && npm start\n'
printf '\n'
printf '%b终端 2 - 启动前端:%b\n' "$CYAN" "$NC"
printf '  cd %s\n' "$PROJECT_ROOT"
printf '  cd client && npm run dev\n'
printf '\n'
printf '或使用 Vite 生产模式：\n'
printf '  cd client && npx vite preview --port %s\n' "$CLIENT_PORT"
printf '\n'
printf '访问地址: %bhttp://%s:%s%b\n' "$CYAN" "$SERVER_IP" "$CLIENT_PORT" "$NC"
printf '\n'
printf '%b注意：%b 原生部署需要保持终端开启，重启后需手动启动\n' "$YELLOW" "$NC"
printf '  推荐使用 PM2 部署以获得进程管理和开机自启功能\n'
printf '\n'