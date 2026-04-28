#!/bin/bash
# ===========================================
# 证件水印处理系统 - PM2 快速更新脚本
# 用于代码更新后重新构建，不重新安装依赖
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

printf '%b===========================================%b\n' "$CYAN" "$NC"
printf '%b  PM2 快速更新（仅重新构建）%b\n' "$CYAN" "$NC"
printf '%b===========================================%b\n' "$CYAN" "$NC"

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    printf '%b✗ PM2 未安装%b\n' "$RED" "$NC"
    printf '\n请先运行 ./deploy-pm2.sh 安装环境\n'
    exit 1
fi

# 检查 node_modules 是否存在
if [ ! -d "$PROJECT_ROOT/server/node_modules" ] || [ ! -d "$PROJECT_ROOT/client/node_modules" ]; then
    printf '\n%b⚠ 依赖未安装完整，需要先运行 ./deploy-pm2.sh 安装环境%b\n' "$YELLOW" "$NC"
    exit 1
fi

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
printf '  前端 Web: http://%s:5173\n' "$SERVER_IP"

# ===========================================
# 构建后端
# ===========================================

printf '\n%b正在构建后端...%b\n' "$CYAN" "$NC"
cd "$PROJECT_ROOT/server"

# 后端构建：转译 TypeScript
if npm run build 2>&1; then
    printf '%b✓ 后端构建完成%b\n' "$GREEN" "$NC"
else
    # 如果没有 build 脚本，尝试 tsc
    if npm run tsc 2>&1; then
        printf '%b✓ 后端构建完成%b\n' "$GREEN" "$NC"
    else
        printf '%b⚠ 后端构建跳过（可能无需构建）%b\n' "$YELLOW" "$NC"
    fi
fi

# ===========================================
# 构建前端
# ===========================================

printf '\n%b正在构建前端...%b\n' "$CYAN" "$NC"
cd "$PROJECT_ROOT/client"

if VITE_API_URL="http://${SERVER_IP}:${SERVER_PORT}/api" npm run build 2>&1; then
    printf '%b✓ 前端构建完成%b\n' "$GREEN" "$NC"
else
    printf '%b✗ 前端构建失败%b\n' "$RED" "$NC"
    exit 1
fi

# ===========================================
# 重启服务
# ===========================================

printf '\n%b正在重启服务...%b\n' "$CYAN" "$NC"

# 重启后端
if pm2 list | grep -q "fastwm-server"; then
    pm2 restart fastwm-server
    printf '  ✓ 后端服务已重启\n'
else
    printf '%b⚠ 后端服务未运行，正在启动...%b\n' "$YELLOW" "$NC"
    cd "$PROJECT_ROOT"
    PORT=$SERVER_PORT pm2 start ecosystem.config.js
fi

# 重启前端
if pm2 list | grep -q "fastwm-client"; then
    pm2 restart fastwm-client
    printf '  ✓ 前端服务已重启\n'
else
    printf '%b⚠ 前端服务未运行，正在启动...%b\n' "$YELLOW" "$NC"
    cd "$PROJECT_ROOT"
    PORT=$SERVER_PORT pm2 start ecosystem.config.js
fi

# 等待服务启动
sleep 2

# 保存进程列表
pm2 save 2>/dev/null || true

# ===========================================
# 显示状态
# ===========================================

printf '\n%b服务状态:%b\n' "$GREEN" "$NC"
pm2 list

printf '\n%b构建和更新完成！%b\n' "$GREEN" "$NC"
printf '访问地址: http://%s:5173\n' "$SERVER_IP"
printf '\n'
