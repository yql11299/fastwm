#!/bin/bash
# ===========================================
# 证件水印处理系统 - Docker 部署脚本
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
printf '%b  证件水印处理系统 - Docker 部署%b\n' "$GREEN" "$NC"
printf '%b===========================================%b\n' "$GREEN" "$NC"

# ===========================================
# 前置环境检查
# ===========================================

printf '\n%b正在检查 Docker 环境...%b\n\n' "$CYAN" "$NC"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    printf '%b✗ Docker 未安装%b\n' "$RED" "$NC"
    printf '\n%b请先安装 Docker:%b\n' "$YELLOW" "$NC"
    printf '\n  Ubuntu/Debian:\n'
    printf '    curl -fsSL https://get.docker.com | sh\n'
    printf '    sudo usermod -aG docker $USER\n'
    printf '\n  CentOS/RHEL:\n'
    printf '    sudo yum install -y docker\n'
    printf '    sudo systemctl start docker\n'
    printf '\n  macOS/Windows:\n'
    printf '    下载 https://www.docker.com/products/docker-desktop\n'
    printf '\n'
    exit 1
fi

# 检查 Docker 守护进程
if ! docker info &> /dev/null; then
    printf '%b✗ Docker 守护进程未运行%b\n' "$RED" "$NC"
    printf '\n%b请启动 Docker Desktop 或 docker 服务%b\n' "$YELLOW" "$NC"
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
# 端口配置
# ===========================================

printf '%b端口配置（直接回车使用默认值）:%b\n' "$CYAN" "$NC"
printf '\n'

printf '后端 API 端口 [%b3000%b]: ' "$YELLOW" "$NC"
read SERVER_PORT
SERVER_PORT=${SERVER_PORT:-3000}

printf '前端 Web 端口 [%b8080%b]: ' "$YELLOW" "$NC"
read CLIENT_PORT
CLIENT_PORT=${CLIENT_PORT:-8080}

if command -v hostname &> /dev/null; then
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
else
    SERVER_IP="localhost"
fi

printf '\n'
printf '%b[1/4] 端口配置:%b\n' "$GREEN" "$NC"
printf '  - 后端 API: %s:%s\n' "$SERVER_IP" "$SERVER_PORT"
printf '  - 前端 Web:  http://%s:%s\n' "$SERVER_IP" "$CLIENT_PORT"
printf '\n'

# ===========================================
# 清理旧构建产物
# ===========================================

printf '%b[2/4] 清理旧容器和镜像...%b\n' "$GREEN" "$NC"

# 停止并删除旧容器
$COMPOSE_CMD down 2>/dev/null || true

# 删除旧镜像（可选，强制重新构建）
docker rmi fastwm-server fastwm-client 2>/dev/null || true

# 清理构建缓存
docker builder prune -f 2>/dev/null || true

printf '  清理完成\n'

# ===========================================
# 创建必要目录
# ===========================================

printf '%b[3/4] 创建必要目录...%b\n' "$GREEN" "$NC"
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
# 构建并启动
# ===========================================

printf '%b[4/4] 构建并启动 Docker 容器...%b\n' "$GREEN" "$NC"

# 设置环境变量并启动
env SERVER_PORT="$SERVER_PORT" CLIENT_PORT="$CLIENT_PORT" JWT_SECRET="${JWT_SECRET:-dev-only-secret-change-in-production}" $COMPOSE_CMD up -d --build

# 等待服务启动
printf '  等待服务启动...\n'
sleep 10

# ===========================================
# 状态检查
# ===========================================

printf '\n'
if $COMPOSE_CMD ps 2>/dev/null | grep -q "Up"; then
    printf '%b===========================================%b\n' "$GREEN" "$NC"
    printf '%b  部署成功！%b\n' "$GREEN" "$NC"
    printf '%b===========================================%b\n' "$GREEN" "$NC"
    printf '\n'
    printf '访问地址: %bhttp://%s:%s%b\n' "$CYAN" "$SERVER_IP" "$CLIENT_PORT" "$NC"
    printf '\n'
    printf '%b常用命令:%b\n' "$YELLOW" "$NC"
    printf '  查看日志:   %s logs -f\n' "$COMPOSE_CMD"
    printf '  停止服务:   %s down\n' "$COMPOSE_CMD"
    printf '  重启服务:   %s restart\n' "$COMPOSE_CMD"
    printf '\n'
else
    printf '%b部署可能有问题，请检查:%b\n' "$YELLOW" "$NC"
    $COMPOSE_CMD ps
    printf '\n详细日志: %s logs\n' "$COMPOSE_CMD"
fi