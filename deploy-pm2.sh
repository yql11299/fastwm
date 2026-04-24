#!/bin/bash
# ===========================================
# 证件水印处理系统 - PM2 部署脚本 (Linux 版)
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

# ===========================================
# 安装 canvas 编译依赖（Linux）
# ===========================================

install_canvas_deps() {
    printf '\n%b正在安装 canvas 编译依赖...%b\n' "$CYAN" "$NC"

    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        local deps="build-essential python3 libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev"
        printf '  检测到 Debian/Ubuntu 系统，安装构建依赖...\n'
        printf '  需要 sudo 权限安装以下包: %s\n' "$deps"
        sudo apt-get update -qq
        sudo apt-get install -y -qq $deps
        printf '%b✓ canvas 依赖安装完成%b\n' "$GREEN" "$NC"
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        local deps="gcc-c++ make python3 cairo-devel pango-devel libjpeg-turbo-devel giflib-devel librsvg2-devel"
        printf '  检测到 CentOS/RHEL 系统，安装构建依赖...\n'
        printf '  需要 sudo 权限安装以下包: %s\n' "$deps"
        sudo yum install -y -q $deps
        printf '%b✓ canvas 依赖安装完成%b\n' "$GREEN" "$NC"
    elif command -v brew &> /dev/null; then
        # macOS
        printf '  检测到 macOS 系统，安装构建依赖...\n'
        brew install pkg-config cairo pango jpeg giflib librsvg
        printf '%b✓ canvas 依赖安装完成%b\n' "$GREEN" "$NC"
    else
        printf '%b⚠ 无法自动安装 canvas 依赖，请手动安装%b\n' "$YELLOW" "$NC"
        printf '  Ubuntu/Debian: sudo apt-get install build-essential python3 libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev\n'
        printf '  CentOS/RHEL:   sudo yum install gcc-c++ make python3 cairo-devel pango-devel libjpeg-turbo-devel giflib-devel librsvg2-devel\n'
        printf '  macOS:         brew install pkg-config cairo pango jpeg giflib librsvg\n'
    fi
}

# 尝试安装 canvas 依赖（失败不终止）
install_canvas_deps 2>/dev/null || true

# ===========================================
# 设置 npm 镜像（国内加速）
# ===========================================

printf '\n%b配置 npm 镜像...%b\n' "$CYAN" "$NC"

# 检查是否已有镜像配置
CURRENT_REGISTRY=$(npm config get registry 2>/dev/null || echo "")
CHINA_MIRROR="https://registry.npmmirror.com"

if [[ "$CURRENT_REGISTRY" == *"npm.taobao"* ]] || [[ "$CURRENT_REGISTRY" == *"npmmirror"* ]]; then
    printf '  %b已配置镜像: %s%b\n' "$GREEN" "$CURRENT_REGISTRY" "$NC"
else
    printf '  设置 npm 镜像为国内镜像...\n'
    npm config set registry "$CHINA_MIRROR" 2>/dev/null || true
    printf '%b✓ npm 镜像配置完成%b\n' "$GREEN" "$NC"
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

# 获取本机 IP 地址（局域网 IP）
get_lan_ip() {
    local ip=""
    # 优先获取局域网 IP（排除 loopback 和 docker）
    if command -v ip &> /dev/null; then
        ip=$(ip route get 1 2>/dev/null | grep -o 'src [0-9.]*' | cut -d' ' -f2 | head -1)
    fi
    if [ -z "$ip" ] || [ "$ip" = "127.0.0.1" ]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}' | head -1)
    fi
    if [ -z "$ip" ] || [ "$ip" = "127.0.0.1" ]; then
        ip="localhost"
    fi
    echo "$ip"
}

SERVER_IP=$(get_lan_ip)

printf '\n'
printf '%b[1/6] 端口配置:%b\n' "$GREEN" "$NC"
printf '  - 后端 API: %s:%s\n' "$SERVER_IP" "$SERVER_PORT"
printf '  - 前端 Web: http://%s:%s\n' "$SERVER_IP" "$CLIENT_PORT"
printf '  - 服务可被局域网内其他机器访问\n'
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

# 清理 package-lock.json（避免缓存问题）
if [ -f "$PROJECT_ROOT/server/package-lock.json" ]; then
    rm -f "$PROJECT_ROOT/server/package-lock.json"
fi
if [ -f "$PROJECT_ROOT/client/package-lock.json" ]; then
    rm -f "$PROJECT_ROOT/client/package-lock.json"
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

# 使用 --ignore-scripts 避免 postinstall 脚本卡住，再用 npm rebuild 单独构建
printf '  执行 npm install --prefer-offline --no-audit...\n'
if npm install --prefer-offline --no-audit --loglevel=error 2>&1; then
    printf '  后端依赖安装完成\n'
else
    printf '%b⚠ npm install 失败，尝试备用方案...%b\n' "$YELLOW" "$NC"
    # 备用：使用 --force
    if npm install --force --prefer-offline --no-audit --loglevel=error 2>&1; then
        printf '  后端依赖安装完成（备用方案）\n'
    else
        printf '%b✗ 后端依赖安装失败%b\n' "$RED" "$NC"
        printf '  请检查日志或手动运行: cd server && npm install\n'
        exit 1
    fi
fi

# ===========================================
# 安装前端依赖并构建
# ===========================================

printf '%b[5/6] 安装前端依赖并构建...%b\n' "$GREEN" "$NC"

cd "$PROJECT_ROOT/client"

if [ ! -d "node_modules" ]; then
    printf '  执行 npm install --prefer-offline --no-audit...\n'
    if npm install --prefer-offline --no-audit --loglevel=error 2>&1; then
        printf '  前端依赖安装完成\n'
    else
        printf '%b⚠ npm install 失败，尝试备用方案...%b\n' "$YELLOW" "$NC"
        if npm install --force --prefer-offline --no-audit --loglevel=error 2>&1; then
            printf '  前端依赖安装完成（备用方案）\n'
        else
            printf '%b✗ 前端依赖安装失败%b\n' "$RED" "$NC"
            exit 1
        fi
    fi
else
    printf '  前端依赖已存在，跳过安装\n'
fi

printf '  执行 npm run build...\n'

# 构建前端，指定后端 API 地址（使用实际 IP，而非 127.0.0.1）
# 这样局域网内其他机器访问时也能正确调用后端 API
if VITE_API_URL="http://${SERVER_IP}:${SERVER_PORT}/api" npm run build 2>&1; then
    printf '  前端构建完成\n'
else
    printf '%b✗ 前端构建失败%b\n' "$RED" "$NC"
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
    # 使用 sed 修改 PORT（兼容 Linux 和 macOS）
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
    printf '本机访问地址: %bhttp://%s:%s%b\n' "$CYAN" "$SERVER_IP" "$CLIENT_PORT" "$NC"
    printf '\n'
    printf '%b局域网访问说明:%b\n' "$YELLOW" "$NC"
    printf '  局域网内其他机器浏览器打开: http://%s:%s\n' "$SERVER_IP" "$CLIENT_PORT"
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