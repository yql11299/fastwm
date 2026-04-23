# ===========================================
# 证件水印处理系统 - Docker 部署脚本
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  证件水印处理系统 - Docker 部署${NC}"
echo -e "${GREEN}===========================================${NC}"

# ===========================================
# 前置环境检查
# ===========================================

echo ""
echo -e "${CYAN}正在检查 Docker 环境...${NC}"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker 未安装${NC}"
    echo ""
    echo -e "${YELLOW}请先安装 Docker:${NC}"
    echo ""
    echo -e "  Windows (WSL 2):"
    echo "    1. 下载 Docker Desktop: https://www.docker.com/products/docker-desktop"
    echo "    2. 安装并启动 Docker Desktop"
    echo "    3. 在 Settings → Resources → WSL Integration 中启用您的发行版"
    echo ""
    echo -e "  Linux (Ubuntu/Debian):"
    echo "    curl -fsSL https://get.docker.com | sh"
    echo "    sudo usermod -aG docker \$USER"
    echo ""
    echo -e "  Linux (CentOS/RHEL):"
    echo "    sudo yum install -y docker"
    echo "    sudo systemctl start docker"
    echo "    sudo systemctl enable docker"
    echo ""
    echo -e "  macOS:"
    echo "    brew install --cask docker"
    echo "    open -a Docker"
    echo ""
    exit 1
fi

# 检查 Docker 守护进程是否运行
if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker 守护进程未运行${NC}"
    echo ""
    echo -e "${YELLOW}请启动 Docker:${NC}"
    echo ""
    echo -e "  Windows: 启动 Docker Desktop 应用"
    echo "  Linux:   sudo systemctl start docker"
    echo "  macOS:   open -a Docker"
    echo ""
    echo -e "${CYAN}如果是 WSL 2 环境，请确保:${NC}"
    echo "  1. Docker Desktop 已安装并运行"
    echo "  2. 已在 Docker Desktop 设置中启用 WSL 集成"
    echo "    (Settings → Resources → WSL Integration)"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Docker 已安装并运行${NC}"

# 检查 docker compose 命令
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo -e "${GREEN}✓ docker-compose 已安装${NC}"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo -e "${GREEN}✓ docker compose 已安装${NC}"
else
    echo -e "${RED}✗ Docker Compose 未安装${NC}"
    echo ""
    echo -e "${YELLOW}请安装 Docker Compose:${NC}"
    echo ""
    echo -e "  Linux:"
    echo "    sudo curl -L \"https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
    echo "    sudo chmod +x /usr/local/bin/docker-compose"
    echo ""
    echo -e "  Windows/Mac: Docker Desktop 已自带 docker compose"
    echo "    请确保 Docker Desktop 是最新版本"
    echo ""
    exit 1
fi

echo ""

# ===========================================
# 端口配置
# ===========================================

echo -e "${CYAN}端口配置（直接回车使用默认值）:${NC}"
echo ""

# 后端端口
read -p "后端 API 端口 [${YELLOW}3000${NC}]: " SERVER_PORT
SERVER_PORT=${SERVER_PORT:-3000}

# 前端端口
read -p "前端 Web 端口 [${YELLOW}8080${NC}]: " CLIENT_PORT
CLIENT_PORT=${CLIENT_PORT:-8080}

# 服务器 IP（用于显示访问地址）
if command -v hostname &> /dev/null; then
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
else
    SERVER_IP="localhost"
fi

echo ""
echo -e "${GREEN}[1/5] 端口配置:${NC}"
echo "  - 后端 API: $SERVER_IP:$SERVER_PORT"
echo "  - 前端 Web:  http://$SERVER_IP:$CLIENT_PORT"
echo ""

# ===========================================
# 目录创建
# ===========================================

echo -e "${GREEN}[2/5] 创建必要目录...${NC}"
mkdir -p "$PROJECT_ROOT/data/users"
mkdir -p "$PROJECT_ROOT/data/documents"
mkdir -p "$PROJECT_ROOT/data/exports"
mkdir -p "$PROJECT_ROOT/data/backgrounds"
mkdir -p "$PROJECT_ROOT/data/fonts"

# 确保 fonts 目录有占位符
if [ ! -f "$PROJECT_ROOT/fonts/.gitkeep" ] && [ -z "$(ls -A "$PROJECT_ROOT/fonts" 2>/dev/null)" ]; then
    touch "$PROJECT_ROOT/fonts/.gitkeep"
fi

echo "  目录创建完成"

# ===========================================
# 环境变量配置
# ===========================================

echo -e "${GREEN}[3/5] 配置环境变量...${NC}"

# 设置环境变量供 docker-compose 使用
export SERVER_PORT
export CLIENT_PORT

if [ ! -f "$PROJECT_ROOT/server/.env" ]; then
    if [ -f "$PROJECT_ROOT/server/.env.example" ]; then
        cp "$PROJECT_ROOT/server/.env.example" "$PROJECT_ROOT/server/.env"
        echo -e "  ${YELLOW}已创建 server/.env${NC}"
    fi
fi

# 检查 JWT_SECRET
if grep -q "JWT_SECRET=dev-only" "$PROJECT_ROOT/server/.env" 2>/dev/null || \
   grep -q "JWT_SECRET=your-secret" "$PROJECT_ROOT/server/.env" 2>/dev/null; then
    echo -e "  ${YELLOW}警告: JWT_SECRET 使用默认值，请修改 server/.env 中的 JWT_SECRET${NC}"
fi

# ===========================================
# 构建并启动
# ===========================================

echo -e "${GREEN}[4/5] 构建并启动 Docker 容器...${NC}"

# 停止现有容器
$COMPOSE_CMD down 2>/dev/null || true

# 构建并启动
SERVER_PORT=$SERVER_PORT CLIENT_PORT=$CLIENT_PORT $COMPOSE_CMD up -d --build

# 等待服务启动
echo -e "${GREEN}[5/5] 等待服务启动...${NC}"
sleep 8

# ===========================================
# 状态检查
# ===========================================

if $COMPOSE_CMD ps | grep -q "Up"; then
    echo ""
    echo -e "${GREEN}===========================================${NC}"
    echo -e "${GREEN}  部署成功！${NC}"
    echo -e "${GREEN}===========================================${NC}"
    echo ""
    echo -e "访问地址: ${CYAN}http://$SERVER_IP:$CLIENT_PORT${NC}"
    echo ""
    echo -e "${YELLOW}局域网访问:${NC}"
    echo "  确保服务器防火墙允许 $CLIENT_PORT 端口入站"
    echo ""
    echo "常用命令:"
    echo "  查看日志:   $COMPOSE_CMD logs -f"
    echo "  停止服务:   $COMPOSE_CMD down"
    echo "  重启服务:   $COMPOSE_CMD restart"
    echo "  查看状态:   $COMPOSE_CMD ps"
    echo ""
    echo -e "${YELLOW}配置文件:${NC}"
    echo "  - 修改端口: 编辑 docker-compose.yml 或重新运行此脚本"
    echo "  - 修改 JWT: 编辑 server/.env"
    echo ""
else
    echo -e "${RED}部署失败，请检查日志: $COMPOSE_CMD logs${NC}"
    exit 1
fi