#!/bin/bash
# ===========================================
# 证件水印处理系统 - 增量构建脚本
# 不删除镜像和缓存，只重新构建代码
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
printf '%b  证件水印处理系统 - 增量构建%b\n' "$GREEN" "$NC"
printf '%b===========================================%b\n' "$GREEN" "$NC"

# ===========================================
# 前置环境检查
# ===========================================

printf '\n%b正在检查 Docker 环境...%b\n\n' "$CYAN" "$NC"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    printf '%b✗ Docker 未安装%b\n' "$RED" "$NC"
    exit 1
fi

# 检查 Docker 守护进程
if ! docker info &> /dev/null; then
    printf '%b✗ Docker 守护进程未运行%b\n' "$RED" "$NC"
    exit 1
fi
printf '%b✓ Docker 已安装并运行%b\n' "$GREEN" "$NC"

# 检查 Docker Compose
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    printf '%b✓ docker-compose 已安装%b\n' "$GREEN" "$NC"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    printf '%b✓ docker compose 已安装%b\n' "$GREEN" "$NC"
else
    printf '%b✗ Docker Compose 未安装%b\n' "$RED" "$NC"
    exit 1
fi

printf '\n'

# ===========================================
# 加载环境变量
# ===========================================

if [ -f "$PROJECT_ROOT/.env" ]; then
    printf '%b加载环境变量配置...%b\n' "$CYAN" "$NC"
    set -a
    source "$PROJECT_ROOT/.env" 2>/dev/null || true
    set +a
    printf '  ✓ .env 已加载\n'
fi

# ===========================================
# 增量构建（保留缓存）
# ===========================================

printf '\n%b开始增量构建...%b\n' "$GREEN" "$NC"

# 停止旧容器但不删除镜像
$COMPOSE_CMD down

# 重新构建（使用构建缓存，不删除镜像）
$COMPOSE_CMD build

# 启动服务
$COMPOSE_CMD up -d

# 等待服务启动
printf '  等待服务启动...\n'
sleep 5

# ===========================================
# 状态检查
# ===========================================

printf '\n'
if $COMPOSE_CMD ps 2>/dev/null | grep -q "Up"; then
    printf '%b===========================================%b\n' "$GREEN" "$NC"
    printf '%b  增量构建成功！%b\n' "$GREEN" "$NC"
    printf '%b===========================================%b\n' "$GREEN" "$NC"
    printf '\n'
    printf '%b常用命令:%b\n' "$YELLOW" "$NC"
    printf '  查看日志:   %s logs -f\n' "$COMPOSE_CMD"
    printf '  停止服务:   %s down\n' "$COMPOSE_CMD"
    printf '\n'
else
    printf '%b构建可能有问题，请检查:%b\n' "$YELLOW" "$NC"
    $COMPOSE_CMD ps
    printf '\n详细日志: %s logs\n' "$COMPOSE_CMD"
fi