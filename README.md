# 证件水印处理系统

企业级证件水印批量处理系统，支持对身份证、营业执照、合同等证件批量添加水印。

## 功能特性

- **批量水印处理**：支持 PDF、图片批量添加水印
- **自定义方案**：保存和管理多种水印预设方案
- **布局管理**：灵活配置证件在画布中的排列方式
- **矢量图形水印**：水印以 SVG Path 矢量方式嵌入，无法简单去除
- **多用户支持**：基于 Cookie 的轻量用户区分

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite 5 + Zustand |
| 后端 | Node.js + Express 4 |
| PDF 处理 | pdf-lib |
| 字体处理 | opentype.js |
| 存储 | JSON 文件（每用户独立） |
| 部署 | Docker |

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装

```bash
# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../client && npm install
```

### 运行

```bash
# 启动后端（端口 3000）
cd server && npm run dev

# 启动前端（端口 5173）
cd client && npm run dev
```

### 测试

```bash
# 后端测试
cd server && npm test

# 前端测试
cd client && npm test
```

## 项目结构

```
├── server/           # 后端服务
│   ├── src/
│   │   ├── routes/   # API 路由
│   │   ├── services/ # 业务逻辑
│   │   ├── middleware/# 中间件
│   │   ├── utils/   # 工具函数
│   │   └── config/  # 配置
│   └── tests/       # 测试
├── client/           # 前端应用
│   └── src/
│       ├── components/  # React 组件
│       ├── api/        # API 客户端
│       └── stores/     # Zustand 状态
└── docs/             # 文档
```

## 文档

详细文档位于 `docs/` 目录下：

| 文档 | 说明 |
|------|------|
| [PRD](./docs/PRD-证件水印处理系统.md) | 完整需求文档 |
| [开发指南](./docs/guide/开发指南.md) | 本地开发、环境搭建、调试 |
| [测试指南](./docs/guide/测试指南.md) | 测试框架、运行测试、编写测试 |
| [部署指南](./docs/guide/部署指南.md) | Docker 部署、生产配置 |
| [API 参考](./docs/reference/API.md) | 后端 API 接口详细文档 |

## 字体说明

系统仅支持 **TTF/OTF** 字体格式，**不支持 TTC 格式**。

Windows 字体目录：`C:\Windows\Fonts\`

常用中文字体：
- 黑体：`simhei.ttf`
- 楷体：`simkai.ttf`
- 宋体：`simsun.ttc` (不支持)
