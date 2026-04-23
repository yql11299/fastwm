# 证件水印处理系统核心功能修复规范

## Why

当前证件水印处理系统存在三个核心功能缺陷：
1. 证件路径配置指向错误的目录，导致无法找到证件文件
2. 画布模块无法加载背景和预览水印，导致用户无法调整水印参数
3. 导出功能不符合 PRD 要求，单文件下载和多文件打包逻辑错误，且产生空 ZIP 文件

这些问题阻塞了系统的核心使用流程，需要立即修复。

## What Changes

### 1. 证件路径配置修复
- 修改 `server/src/config/index.js` 中的 `documents` 配置，从 `test_data` 改为 `server/documents`
- **BREAKING**: 现有的文件 ID 会因为路径变化而改变，需要更新 `favorites.json` 和 `layout.json`

### 2. 画布模块修复
- 新增后端 API `GET /api/documents/:id/content` 获取文件内容（返回 base64）
- 修改前端 `Canvas.jsx` 处理 URL 参数 `backgroundId` 和 `backgroundType`
- 修改前端 `BackgroundUpload.jsx` 支持从服务器加载背景
- 新增前端 API 调用方法 `documentsApi.getDocumentContent(id)`

### 3. 导出功能修复
- 修改后端 `process.js` 的下载逻辑，正确处理单文件下载和多文件打包
- 修复前端传递的 `format` 参数与后端判断条件不匹配的问题
- 添加详细的错误日志帮助排查空 ZIP 问题

### 4. 测试验证流程
- 添加完整的功能测试步骤
- 添加 API 测试命令
- 添加端到端测试场景

## Impact

- **Affected specs**: 证件管理、画布编辑、导出处理
- **Affected code**:
  - `server/src/config/index.js`
  - `server/src/routes/documents.js`
  - `server/src/routes/process.js`
  - `server/src/services/watermarkEngine.js`
  - `client/src/api/client.js`
  - `client/src/components/canvas/Canvas.jsx`
  - `client/src/components/canvas/BackgroundUpload.jsx`
  - `users/admin/favorites.json`
  - `users/admin/layout.json`

---

## ADDED Requirements

### Requirement: 文件内容获取 API

系统应提供 API 获取证件文件内容，供画布加载背景使用。

#### Scenario: 成功获取图片文件内容
- **WHEN** 用户请求 `GET /api/documents/:id/content`
- **AND** 文件存在且为图片类型
- **THEN** 返回文件的 base64 编码内容
- **AND** 响应包含正确的 Content-Type

#### Scenario: 成功获取 PDF 文件内容
- **WHEN** 用户请求 `GET /api/documents/:id/content`
- **AND** 文件存在且为 PDF 类型
- **THEN** 返回文件的 base64 编码内容
- **AND** 响应包含 `application/pdf` Content-Type

#### Scenario: 文件不存在
- **WHEN** 用户请求不存在的文件 ID
- **THEN** 返回 404 错误

---

### Requirement: 画布背景自动加载

系统应在用户从首页跳转到画布时，自动加载选中的证件作为背景。

#### Scenario: 从首页跳转到画布
- **WHEN** 用户在首页选择一个证件
- **AND** 点击"新建方案"按钮
- **THEN** 跳转到画布页面
- **AND** 自动加载选中的证件作为背景
- **AND** 背景正确显示在画布中

#### Scenario: 直接访问画布
- **WHEN** 用户直接访问画布页面（无 URL 参数）
- **THEN** 显示空白画布
- **AND** 用户可以手动上传背景

---

### Requirement: 单文件直接下载

系统应在导出单个证件时，直接下载 PDF 文件，不打包为 ZIP。

#### Scenario: 导出单个证件
- **WHEN** 用户选择 1 个证件
- **AND** 输入水印文字
- **AND** 点击"一键生成"
- **THEN** 直接下载带水印的 PDF 文件
- **AND** 文件名符合命名规则

#### Scenario: 导出多个证件
- **WHEN** 用户选择 2 个或更多证件
- **AND** 输入水印文字
- **AND** 点击"一键生成"
- **THEN** 下载 ZIP 压缩包
- **AND** ZIP 包含所有带水印的 PDF 文件

---

## MODIFIED Requirements

### Requirement: 证件路径配置

系统应将证件目录配置指向正确的路径。

**原配置**:
```javascript
documents: process.env.DOCUMENTS_PATH || path.join(ROOT_DIR, 'test_data')
```

**修改后**:
```javascript
documents: process.env.DOCUMENTS_PATH || path.join(ROOT_DIR, 'server/documents')
```

---

### Requirement: 导出下载逻辑

系统应正确处理单文件和多文件下载。

**原逻辑**:
```javascript
// 单文件直接下载
if (successResults.length === 1 && !format) {
  // 直接下载
}
// 多文件打包下载
const { buffer, fileName } = await watermarkEngine.packageResultsAsZip(taskId);
```

**修改后**:
```javascript
// 单文件直接下载
if (successResults.length === 1 || format === 'file') {
  // 直接下载
}
// 多文件打包下载
if (successResults.length > 1 && format !== 'file') {
  // 打包下载
}
```

---

## REMOVED Requirements

无移除的需求。

---

## 技术细节

### 问题根因分析

#### 问题1: 导出空 ZIP 文件

**根本原因**: 前后端参数不匹配

前端代码 (`DocumentList.jsx` 第 194 行):
```javascript
await processApi.downloadResult(result.data.taskId, selectedDocuments.length === 1 ? 'file' : 'zip');
```

后端代码 (`process.js` 第 254 行):
```javascript
if (successResults.length === 1 && !format) {
  // 单文件下载
}
```

**问题**: 前端总是传递 `format` 参数（`file` 或 `zip`），后端判断条件 `!format` 永远为 `false`，导致即使单文件也会走 ZIP 打包流程。

#### 问题2: 文件 ID 解析失败

**根本原因**: `DOCS_ROOT` 配置指向错误目录

- `documents.js` 和 `process.js` 都使用 `config.dirs.documents` 作为 `DOCS_ROOT`
- 当前配置指向 `test_data`，但实际文件在 `server/documents`
- 导致 `resolveFileId` 函数无法找到文件

#### 问题3: 画布无法加载背景

**根本原因**: 缺少服务器文件加载功能

- 首页跳转时传递了 `backgroundId` 参数
- Canvas.jsx 没有读取和处理这些参数
- 后端没有提供获取文件内容的 API

### 修复方案

#### 方案1: 修复证件路径配置

1. 修改 `server/src/config/index.js`
2. 更新 `users/admin/favorites.json` 和 `users/admin/layout.json` 中的文件 ID

#### 方案2: 添加文件内容 API

1. 在 `server/src/routes/documents.js` 添加 `GET /api/documents/:id/content` 端点
2. 在 `client/src/api/client.js` 添加 `getDocumentContent(id)` 方法

#### 方案3: 修复画布背景加载

1. 在 `Canvas.jsx` 中读取 URL 参数并调用 API 加载背景
2. 更新 `BackgroundUpload.jsx` 支持服务器文件加载

#### 方案4: 修复导出下载逻辑

1. 修改 `process.js` 的下载判断条件
2. 确保单文件直接下载，多文件打包下载

---

## 测试验证

### API 测试

```bash
# 1. 测试证件列表 API
curl http://localhost:3000/api/documents -H "Cookie: auth_token=<token>"

# 2. 测试文件内容 API（新增）
curl http://localhost:3000/api/documents/doc_xxx/content -H "Cookie: auth_token=<token>"

# 3. 测试水印处理 API
curl -X POST http://localhost:3000/api/process/watermark \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=<token>" \
  -d '{"fileIds":["doc_xxx"],"text":"测试水印"}'

# 4. 测试下载 API
curl http://localhost:3000/api/process/download/<taskId>?format=file \
  -H "Cookie: auth_token=<token>" \
  -o test.pdf
```

### 端到端测试

1. **登录测试**
   - 访问 http://localhost:5173/login
   - 选择 admin 用户登录
   - 验证跳转到首页

2. **证件列表测试**
   - 验证首页显示常用证件列表
   - 验证证件来自 `server/documents` 目录

3. **画布测试**
   - 选择一个证件
   - 点击"新建方案"
   - 验证画布自动加载背景
   - 输入水印文字
   - 验证水印预览显示

4. **导出测试**
   - 选择 1 个证件
   - 输入水印文字
   - 点击"一键生成"
   - 验证直接下载 PDF 文件

5. **批量导出测试**
   - 选择 2 个证件
   - 输入水印文字
   - 点击"一键生成"
   - 验证下载 ZIP 文件
   - 解压验证包含正确的 PDF 文件
