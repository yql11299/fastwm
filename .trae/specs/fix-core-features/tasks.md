# Tasks

## Task 1: 修复证件路径配置
修改后端配置文件，将证件目录指向正确的路径 `server/documents`。

- [x] SubTask 1.1: 修改 `server/src/config/index.js` 中的 `documents` 配置
- [x] SubTask 1.2: 重启后端服务验证配置生效
- [x] SubTask 1.3: 更新 `users/admin/favorites.json` 中的文件 ID（因为路径变化导致 ID 变化）
- [x] SubTask 1.4: 更新 `users/admin/layout.json` 中的文件 ID

**验证**: 调用 `GET /api/documents` 返回 `server/documents` 目录下的文件列表

---

## Task 2: 添加文件内容获取 API
后端新增 API 获取证件文件内容，供画布加载背景使用。

- [x] SubTask 2.1: 在 `server/src/routes/documents.js` 添加 `GET /api/documents/:id/content` 端点
- [x] SubTask 2.2: 实现文件读取并返回 base64 编码的内容
- [x] SubTask 2.3: 添加文件类型检测和正确的 Content-Type 响应头
- [x] SubTask 2.4: 在 `client/src/api/client.js` 添加 `getDocumentContent(id)` 方法

**验证**: 调用 `GET /api/documents/:id/content` 返回文件的 base64 内容

---

## Task 3: 修复画布背景加载功能
修改前端画布组件，使其能够从服务器加载背景文件。

- [x] SubTask 3.1: 在 `Canvas.jsx` 中读取 URL 参数 `backgroundId` 和 `backgroundType`
- [x] SubTask 3.2: 调用新增的文件内容 API 加载背景
- [x] SubTask 3.3: 更新 `BackgroundUpload.jsx` 支持从服务器加载背景
- [x] SubTask 3.4: 添加加载状态和错误处理

**验证**: 从首页跳转到画布时，自动加载选中的证件作为背景

---

## Task 4: 修复水印预览功能
确保水印预览功能正常工作。

- [x] SubTask 4.1: 验证 `fonts/text-to-path` API 正常工作
- [x] SubTask 4.2: 检查 `watermarkRenderer.js` 的渲染逻辑
- [x] SubTask 4.3: 确保 pathData 正确传递到 Canvas
- [x] SubTask 4.4: 添加调试日志帮助排查问题

**验证**: 在画布中输入水印文字后，预览正确显示

---

## Task 5: 修复导出下载逻辑
修复单文件下载和多文件打包的逻辑错误。

- [x] SubTask 5.1: 修改 `server/src/routes/process.js` 的下载判断条件
- [x] SubTask 5.2: 确保单文件直接下载 PDF，多文件打包 ZIP
- [x] SubTask 5.3: 添加详细的错误日志
- [x] SubTask 5.4: 验证文件处理流程正确（文件存在、字体存在）

**验证**: 
- 选择 1 个证件导出，直接下载 PDF 文件
- 选择 2 个证件导出，下载 ZIP 文件且包含正确的 PDF

---

## Task 6: 端到端测试验证
执行完整的功能测试流程。

- [x] SubTask 6.1: 测试登录功能
- [x] SubTask 6.2: 测试证件列表显示
- [x] SubTask 6.3: 测试画布背景加载
- [x] SubTask 6.4: 测试水印预览
- [x] SubTask 6.5: 测试单文件导出
- [x] SubTask 6.6: 测试多文件导出

**验证**: 所有测试场景通过

---

# Task Dependencies

```
Task 1 (证件路径配置)
    │
    ├──► Task 2 (文件内容 API)
    │        │
    │        └──► Task 3 (画布背景加载)
    │                 │
    │                 └──► Task 4 (水印预览)
    │
    └──► Task 5 (导出下载逻辑) ◄── Task 1
              │
              └──► Task 6 (端到端测试) ◄── Task 3, Task 4, Task 5
```

**并行执行**:
- Task 2 和 Task 5 可以并行执行（都依赖 Task 1）
- Task 3 和 Task 4 必须串行执行（Task 4 依赖 Task 3）

**关键路径**: Task 1 → Task 2 → Task 3 → Task 4 → Task 6
