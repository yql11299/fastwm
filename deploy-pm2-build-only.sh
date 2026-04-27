#!/bin/bash
# ===========================================
# 证件水印处理系统 - 仅构建前端脚本
# 用于前端代码更新后重新构建，不重新安装依赖
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"

printf '%b===========================================%b\n' "$CYAN" "$NC"
printf '%b  仅构建前端（不安装依赖）%b\n' "$CYAN" "$NC"
printf '%b===========================================%b\n' "$CYAN" "$NC"

# 获取端口配置
cd "$PROJECT_ROOT/server"
if [ -f ".env" ]; then
    SERVER_PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
    SERVER_PORT=${SERVER_PORT:-3000}
else
    SERVER_PORT=3000
fi

cd "$PROJECT_ROOT"

# 获取本机 IP
get_lan_ip() {
    local ip=""
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

printf '\n%b配置信息:%b\n' "$GREEN" "$NC"
printf '  后端 API: http://%s:%s\n' "$SERVER_IP" "$SERVER_PORT"

# 进入前端目录
cd "$PROJECT_ROOT/client"

# 检查依赖
if [ ! -d "node_modules" ]; then
    printf '\n%b⚠ node_modules 不存在，需要先运行 deploy-pm2.sh 安装依赖%b\n' "$YELLOW" "$NC"
    exit 1
fi

# 构建前端
printf '\n%b正在构建前端...%b\n' "$CYAN" "$NC"
if VITE_API_URL="http://${SERVER_IP}:${SERVER_PORT}/api" npm run build 2>&1; then
    printf '\n%b✓ 前端构建完成%b\n' "$GREEN" "$NC"
else
    printf '\n%b✗ 前端构建失败%b\n' "$RED" "$NC"
    exit 1
fi

# 重启前端服务
printf '\n%b重启前端服务...%b\n' "$CYAN" "$NC"
pm2 restart fastwm-client 2>/dev/null || pm2 start ecosystem.config.js --env production

printf '\n%b构建和重启完成！%b\n' "$GREEN" "$NC"
printf '访问地址: http://%s:5173\n' "$SERVER_IP"
printf '\n'
