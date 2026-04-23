# 检查清单

## 配置修复

- [x] 证件路径配置已修改为 `server/documents`
- [x] 后端服务重启后配置生效
- [x] `users/admin/favorites.json` 中的文件 ID 已更新
- [x] `users/admin/layout.json` 中的文件 ID 已更新

## 文件内容 API

- [x] `GET /api/documents/:id/content` 端点已添加
- [x] 图片文件返回正确的 base64 内容和 Content-Type
- [x] PDF 文件返回正确的 base64 内容和 Content-Type
- [x] 文件不存在时返回 404 错误
- [x] 前端 `documentsApi.getDocumentContent(id)` 方法已添加

## 画布背景加载

- [x] Canvas.jsx 正确读取 URL 参数 `backgroundId` 和 `backgroundType`
- [x] 从服务器加载背景文件成功
- [x] 背景正确显示在画布中
- [x] 加载状态和错误处理已添加

## 水印预览

- [x] `fonts/text-to-path` API 正常工作
- [x] 水印预览正确显示在画布中
- [x] 水印位置、大小、旋转等参数调整后实时更新

## 导出下载逻辑

- [x] 单文件导出直接下载 PDF 文件
- [x] 多文件导出下载 ZIP 文件
- [x] ZIP 文件包含正确的 PDF 文件（非空）
- [x] 文件名符合命名规则
- [x] 错误日志已添加

## 端到端测试

- [x] 登录功能正常
- [x] 首页显示常用证件列表
- [x] 证件来自 `server/documents` 目录
- [x] 从首页跳转到画布自动加载背景
- [x] 水印预览正常显示
- [x] 单文件导出正常
- [x] 多文件导出正常
