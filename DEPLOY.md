# Docker 部署指南

## 系统要求

- Linux / macOS / Windows (WSL2)
- Docker 20.10+
- Docker Compose 2.0+

## 快速部署

```bash
# 一键部署（会自动构建并启动服务）
./deploy.sh
```

## 手动部署

```bash
# 1. 创建必要目录
mkdir -p data/users data/documents data/exports data/backgrounds data/fonts

# 2. 复制并修改环境变量
cp server/.env.example server/.env
vim server/.env  # 修改 JWT_SECRET 为强密码

# 3. 构建并启动
docker-compose build
docker-compose up -d

# 4. 查看状态
docker-compose ps
```

## 访问服务

- 前端地址: http://localhost
- 后端 API: http://localhost:3000
- 健康检查: http://localhost/health

## 常用命令

```bash
# 查看日志
docker-compose logs -f

# 查看服务状态
docker-compose ps

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

## 目录结构

```
.
├── data/               # 持久化数据目录
│   ├── users/         # 用户数据
│   ├── documents/     # 证件文档
│   ├── exports/       # 导出的水印文件
│   └── backgrounds/   # 背景图片
├── fonts/             # 字体文件 (TTF/OTF)
├── server/            # 后端服务
└── client/            # 前端应用
```

## 数据持久化

所有数据存储在 `data/` 目录下，删除容器不会丢失数据。

## 注意事项

1. **生产环境**: 请修改 `server/.env` 中的 `JWT_SECRET` 为强密码
2. **字体文件**: 将 TTF/OTF 字体文件放入 `fonts/` 目录
3. **端口占用**: 确保 80 和 3000 端口未被占用
