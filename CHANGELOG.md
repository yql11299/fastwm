# 证件水印处理系统 - 更新日志

## v1.0.1 (2026-05-06)

### 🐛 Bug 修复

#### 构建部署相关

1. **修复原生部署脚本缺少 `VITE_API_URL` 环境变量**
   - 文件: `deploy-node.bat`、`deploy-node.sh`
   - 问题: 原生部署脚本构建前端时未设置 `VITE_API_URL`，导致跨机访问时 API 请求指向 `localhost` 失败
   - 修复: 在构建前端前设置 `VITE_API_URL=http://{SERVER_IP}:{SERVER_PORT}/api`

2. **修复 Docker Windows 部署脚本未加载 `.env` 文件**
   - 文件: `deploy-docker.bat`
   - 问题: Windows Docker 部署脚本未从 `.env` 文件加载配置（如 `USERS_HOST_PATH`、`DOCUMENTS_HOST_PATH` 等），导致 Docker Compose 无法正确读取目录映射配置
   - 修复: 添加 `.env` 文件解析逻辑，支持加载自定义目录路径配置

3. **修复 `deploy-pm2-update.bat` 代码页错误**
   - 文件: `deploy-pm2-update.bat`
   - 问题: 使用了错误的代码页 `65025`（不存在），应该是 `65001`（UTF-8）
   - 修复: 将 `chcp 65025` 改为 `chcp 65001`

#### 代码规范

4. **修复 `textToPath.js` 混用 ESM 和 CommonJS**
   - 文件: `server/src/services/textToPath.js`
   - 问题: 文件顶部使用 ESM `import`，但函数内部使用 CJS `require('fs')` 和 `require('fs/promises')`，在严格 ESM 环境下可能报错
   - 修复: 统一使用 ESM `import fs from 'fs'`，并移除 `require` 调用

#### 功能一致性

5. **统一前后端水印 `scale` 默认值**
   - 文件: `server/src/routes/auth.js`
   - 问题: 后端初始化用户数据时 `scale=0.5`，前端默认值为 `0.05`，两者相差 10 倍，导致用户体验不一致
   - 修复: 将后端默认值从 `0.5` 改为 `0.05`，与前端保持一致

### ✅ 已验证

- PDF 字体切换功能正常（楷体/黑体/宋体/微软雅黑）
- 文件上传导入功能正常
- 布局支持一行塞入大于 4 个证件

### 📝 待改进

- 生产环境前端服务建议使用 Nginx 替代 `vite preview`，以获得更好的性能和稳定性
- 构建脚本数量较多，建议统一为一个入口脚本或使用配置文件管理

---

## v1.0.0 (初始版本)

- 证件水印处理系统首次发布
- 支持 PDF 和图片水印处理
- 支持多种字体切换
- 提供 Docker 和 PM2 部署方式