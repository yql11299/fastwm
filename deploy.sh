#!/bin/bash
# ===========================================
# 证件水印处理系统 - PM2 部署脚本
# ===========================================

set -e

# 颜色定义（使用 printf 确保跨平台兼容）
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目根目录（兼容符号链接）
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
    printf '\n  Linux (Ubuntu/Debian):\n'
    printf '    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n'
    printf '    sudo apt-get install -y nodejs\n'
    printf '\n  Linux (CentOS/RHEL):\n'
    printf '    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -\n'
    printf '    sudo yum install -y nodejs\n'
    printf '\n  macOS:\n'
    printf '    brew install node@20\n'
    printf '\n  Windows:\n'
    printf '    下载 https://nodejs.org/ 安装\n'
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
    printf '%b✗ PM2 未安装%b\n' "$RED" "$NC"
    printf '\n%b正在安装 PM2...%b\n' "$YELLOW" "$NC"
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

# 后端端口
printf '后端 API 端口 [%b3000%b]: ' "$YELLOW" "$NC"
read SERVER_PORT
SERVER_PORT=${SERVER_PORT:-3000}

# 前端端口
printf '前端 Web 端口 [%b5173%b]: ' "$YELLOW" "$NC"
read CLIENT_PORT
CLIENT_PORT=${CLIENT_PORT:-5173}

# 服务器 IP
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
# 依赖安装
# ===========================================

printf '%b[2/5] 安装后端依赖...%b\n' "$GREEN" "$NC"

if [ ! -d "$PROJECT_ROOT/server/node_modules" ]; then
    cd "$PROJECT_ROOT/server"
    npm install --production
    printf '  后端依赖安装完成\n'
else
    printf '  后端依赖已存在，跳过\n'
fi

printf '\n'
printf '%b[3/5] 构建前端...%b\n' "$GREEN" "$NC"

if [ ! -d "$PROJECT_ROOT/client/node_modules" ]; then
    cd "$PROJECT_ROOT/client"
    npm install
fi

cd "$PROJECT_ROOT/client"
npm run build

if [ -d "$PROJECT_ROOT/client/dist" ]; then
    printf '  前端构建完成\n'
else
    printf '%b✗ 前端构建失败%b\n' "$RED" "$NC"
    exit 1
fi

printf '\n'

# ===========================================
# 环境变量配置
# ===========================================

printf '%b[4/5] 配置环境变量...%b\n' "$GREEN" "$NC"

if [ ! -f "$PROJECT_ROOT/server/.env" ]; then
    if [ -f "$PROJECT_ROOT/server/.env.example" ]; then
        cp "$PROJECT_ROOT/server/.env.example" "$PROJECT_ROOT/server/.env"
        printf '  %b已创建 server/.env%b\n' "$YELLOW" "$NC"
    fi
fi

# 修改 .env 中的端口
if [ -f "$PROJECT_ROOT/server/.env" ]; then
    # 使用 sed 修改端口（兼容 Linux/macOS）
    sed -i.bak "s/^PORT=.*/PORT=$SERVER_PORT/" "$PROJECT_ROOT/server/.env" 2>/dev/null || \
    sed -i '' "s/^PORT=.*/PORT=$SERVER_PORT/" "$PROJECT_ROOT/server/.env" 2>/dev/null || true
    rm -f "$PROJECT_ROOT/server/.env.bak" 2>/dev/null || true
fi

# 检查 JWT_SECRET
if [ -f "$PROJECT_ROOT/server/.env" ]; then
    if grep -q "JWT_SECRET=dev-only" "$PROJECT_ROOT/server/.env" 2>/dev/null || \
       grep -q "JWT_SECRET=your-secret" "$PROJECT_ROOT/server/.env" 2>/dev/null; then
        printf '  %b警告: JWT_SECRET 使用默认值，请修改 server/.env 中的 JWT_SECRET%b\n' "$YELLOW" "$NC"
    fi
fi

# ===========================================
# 使用 PM2 启动服务
# ===========================================

printf '\n%b[5/5] 启动服务...%b\n' "$GREEN" "$NC"

# 创建日志目录
mkdir -p "$PROJECT_ROOT/logs"

# 停止旧进程
pm2 stop fastwm-server fastwm-client 2>/dev/null || true
pm2 delete fastwm-server fastwm-client 2>/dev/null || true

# 启动后端
cd "$PROJECT_ROOT"
PORT=$SERVER_PORT pm2 start ecosystem.config.js --only fastwm-server

# 启动前端
cd "$PROJECT_ROOT/client"
pm2 start ecosystem.config.js --only fastwm-client

# 等待服务启动
sleep 3

# 保存 PM2 进程列表
pm2 save

# 设置开机自启
pm2 startup 2>/dev/null || true

# ===========================================
# 状态检查
# ===========================================

printf '\n'
if pm2 list | grep -q "fastwm-server.*online" && pm2 list | grep -q "fastwm-client.*online"; then
    printf '%b===========================================%b\n' "$GREEN" "$NC"
    printf '%b  部署成功！%b\n' "$GREEN" "$NC"
    printf '%b===========================================%b\n' "$GREEN" "$NC"
    printf '\n'
    printf '访问地址: %bhttp://%s:%s%b\n' "$CYAN" "$SERVER_IP" "$CLIENT_PORT" "$NC"
    printf '\n'
    printf '%b局域网访问:%b\n' "$YELLOW" "$NC"
    printf '  确保服务器防火墙允许 %s 端口入站\n' "$CLIENT_PORT"
    printf '\n'
    printf '常用命令:\n'
    printf '  查看日志:   pm2 logs\n'
    printf '  查看状态:   pm2 list\n'
    printf '  重启服务:   pm2 restart all\n'
    printf '  停止服务:   pm2 stop all\n'
    printf '\n'
    printf '%b配置文件:%b\n' "$YELLOW" "$NC"
    printf '  - 修改端口: 重启脚本或手动修改 server/.env\n'
    printf '  - 修改 JWT: 编辑 server/.env\n'
    printf '\n'
else
    printf '%b部署可能有问题，请检查:%b\n' "$YELLOW" "$NC"
    pm2 list
    printf '\n详细日志: pm2 logs\n'
fi