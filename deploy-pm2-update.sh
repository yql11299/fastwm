#!/bin/bash
# ===========================================
# 证件水印处理系统 - PM2 快速更新脚本
# 用于代码更新后重启服务，不重新安装依赖
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"

printf '%b===========================================%b\n' "$CYAN" "$NC"
printf '%b  PM2 快速更新服务%b\n' "$CYAN" "$NC"
printf '%b===========================================%b\n' "$CYAN" "$NC"

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    printf '%b✗ PM2 未安装%b\n' "$RED" "$NC"
    printf '\n请先运行 ./deploy-pm2.sh 安装环境\n'
    exit 1
fi

printf '\n%b正在重启服务...%b\n\n' "$CYAN" "$NC"

# 检查服务是否存在
if pm2 list | grep -q "fastwm-server"; then
    printf '  重启后端服务...\n'
    pm2 restart fastwm-server
else
    printf '%b⚠ 后端服务未运行，正在启动...%b\n' "$YELLOW" "$NC"
fi

if pm2 list | grep -q "fastwm-client"; then
    printf '  重启前端服务...\n'
    pm2 restart fastwm-client
else
    printf '%b⚠ 前端服务未运行，正在启动...%b\n' "$YELLOW" "$NC"
fi

# 等待服务启动
sleep 2

# 获取端口
SERVER_PORT=$(grep "^PORT=" server/.env 2>/dev/null | cut -d'=' -f2)
SERVER_PORT=${SERVER_PORT:-3000}
CLIENT_PORT=5173

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

# 显示状态
printf '\n%b服务状态:%b\n' "$GREEN" "$NC"
pm2 list

printf '\n%b访问地址:%b\n' "$GREEN" "$NC"
printf '  本机访问: http://localhost:%s\n' "$CLIENT_PORT"
printf '  局域网访问: http://%s:%s\n' "$SERVER_IP" "$CLIENT_PORT"
printf '  后端 API: http://%s:%s\n' "$SERVER_IP" "$SERVER_PORT"

printf '\n%b常用命令:%b\n' "$YELLOW" "$NC"
printf '  查看日志:   pm2 logs\n'
printf '  查看状态:   pm2 list\n'
printf '  重启所有:   pm2 restart all\n'
printf '  停止所有:   pm2 stop all\n'
printf '\n'
