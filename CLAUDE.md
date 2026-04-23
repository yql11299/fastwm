# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**证件水印处理系统** (fastwm) - 企业级证件水印批量处理系统，支持对身份证、营业执照、合同等证件批量添加水印。

**技术栈**: React 18 + Vite 5 (前端) | Node.js + Express 4 (后端) | pdf-lib + opentype.js (PDF处理) | Zustand (状态管理)

---

## 模块架构

项目分为以下 7 个主要模块：

| 模块 | 前端组件 | 后端路由 | 状态管理 |
|------|----------|----------|----------|
| 1. 登录和用户管理 | Login.jsx | auth.js | useAuth.js, appStore |
| 2. 首页UI显示 | DocumentList.jsx | - | appStore |
| 3. 布局调整 | LayoutEditor.jsx | layout.js | appStore, useDrag |
| 4. 画布背景水印预览 | Canvas.jsx (bg/wmCanvas) | - | watermarkRenderer.js |
| 5. 画布UI显示 | Canvas.jsx, PropertyPanel.jsx, TransformHandles.jsx | - | appStore, useCanvas |
| 6. 水印方案管理 | SchemeList.jsx, SchemeSaveModal.jsx | watermark.js | appStore |
| 7. 水印文件处理导出 | - | process.js, watermarkEngine.js | - |

---

## 1. 登录和用户管理模块

### 功能描述
用户登录、登出、用户列表展示、用户创建、Cookie-based 认证。

### 前端文件
- `client/src/components/auth/Login.jsx` - 登录页面组件
- `client/src/hooks/useAuth.js` - 认证状态 Hook

### 后端文件
- `server/src/routes/auth.js` - 认证路由

### 处理流程
```
前端: Login.jsx → useAuth.login() → POST /api/auth/login
后端: auth.js → 检查/创建用户目录 → 生成 JWT → 设置 Cookie
```

### 用户数据结构
```json
{
  "id": "admin",
  "username": "admin",
  "createdAt": "2026-01-01T00:00:00Z",
  "export": { "namingRule": "timestamp_text", "quality": 100 },
  "defaultWatermark": { "text": "", "x": 0.5, "y": 0.5, "scale": 0.5, ... }
}
```

### 存储位置
- `server/data/users/{userId}/settings.json` - 用户配置文件
- `server/data/users/{userId}/favorites.json` - 常用证件列表
- `server/data/users/{userId}/layout.json` - 布局配置
- `server/data/users/{userId}/schemes/{schemeId}.json` - 水印方案

### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录（自动创建用户） |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/current | 获取当前用户 |
| GET | /api/auth/users | 获取用户列表 |
| POST | /api/auth/users | 创建用户 |

---

## 2. 首页UI显示模块

### 功能描述
显示常用证件列表（按布局分组）、水印文字输入、预设方案选择、一键生成按钮。

### 前端文件
- `client/src/components/documents/DocumentList.jsx` - 首页组件
- `client/src/components/documents/DocumentCard.jsx` - 证件卡片组件

### 状态依赖
- `appStore.selectedDocuments` - 已选中的证件ID列表
- `appStore.favorites` - 常用证件列表
- `appStore.layoutItems` - 布局配置
- `appStore.watermark` - 当前水印配置
- `appStore.schemes` - 预设方案列表

### 处理流程
1. 加载布局配置 `GET /api/layout`
2. 加载常用证件 `GET /api/documents/favorites`
3. 加载预设方案 `GET /api/watermark/schemes?type=preset`
4. 用户输入水印文字、选择证件
5. 点击"一键生成" → `POST /api/process/watermark`

### 布局分组逻辑
```javascript
// 按 row 分组显示证件，row 内按 order 排序
favorites.reduce((acc, doc) => {
  const row = layoutItems.find(item => item.fileId === doc.id)?.row ?? 0;
  if (!acc[row]) acc[row] = [];
  acc[row].push(doc);
  return acc;
}, {});
```

---

## 3. 布局调整模块

### 功能描述
拖拽调整证件排列顺序、删除证件、添加新证件到布局、保存布局配置。

### 前端文件
- `client/src/components/layout/LayoutEditor.jsx` - 布局编辑器组件
- `client/src/hooks/useDrag.js` - 拖拽交互 Hook

### 后端文件
- `server/src/routes/layout.js` - 布局路由

### 布局数据结构
```json
{
  "userId": "admin",
  "updatedAt": "2026-01-01T00:00:00Z",
  "items": [
    { "fileId": "doc_xxx", "fileName": "身份证.jpg", "row": 0, "order": 0 },
    { "fileId": "doc_yyy", "fileName": "营业执照.jpg", "row": 1, "order": 0 }
  ]
}
```

### 拖拽规则
- 允许跨行移动证件
- 不允许跨行自动补位（移走后本行内其他证件不移动）
- 行尾有虚线框空位
- 最后一行下方有多个空位用于添加新行
- 拖入垃圾桶区域可从布局移除

### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/layout | 获取用户布局 |
| PUT | /api/layout | 保存布局 |
| POST | /api/layout/export | 导出布局为 JSON |
| POST | /api/layout/import | 导入布局 JSON |

---

## 4. 画布内背景和水印预览模块

### 功能描述
Canvas + SVG Overlay 架构，在前端预览 PDF/图片背景上的水印效果，与后端导出保持一致。

### 前端文件
- `client/src/utils/watermarkRenderer.js` - 水印渲染工具
- `client/src/utils/pdfRenderer.js` - PDF 渲染工具
- `client/src/components/canvas/BackgroundUpload.jsx` - 背景上传组件

### 核心渲染逻辑

**背景渲染** (BackgroundUpload.jsx):
- PDF: 使用 pdfjs-dist 渲染到 Canvas
- 图片: 直接 drawImage 到 Canvas

**水印渲染** (watermarkRenderer.js):
```javascript
// scale=0.05 表示字体大小是背景宽度的 5%
const fontSize = canvasWidth * watermark.scale;

// 水印中心点位置
const centerX = canvasWidth * watermark.x;
const centerY = canvasHeight * watermark.y;

// 注册 TTF 字体并绘制
ctx.font = `${fontSize}px "黑体"`;
ctx.fillText(text, centerX, centerY);

// 绘制时绕中心点旋转
ctx.translate(centerX, centerY);
ctx.rotate((rotation * Math.PI) / 180);
ctx.translate(-centerX, -centerY);
```

### Scale 语义
| scale 值 | 含义 |
|----------|------|
| 0.0 | 水印不可见 |
| 0.05 | 字体大小 = 背景宽度的 5% |
| 0.1 | 字体大小 = 背景宽度的 10% |

### 渲染方案
后端采用混合渲染方案（保持 PDF 矢量内容）：
1. **PDF**: pdf-lib 读取原件保持矢量
2. **图片**: canvas 直接加载图片
3. **水印**: Canvas fillText() + registerFont() 绘制 TTF 字体为 PNG
4. **叠加**: pdf-lib drawImage() 叠加 PNG 水印到原件
5. **输出**: 保持矢量化 PDF + 正确的中文水印

```
PDF 原件 (矢量) ──→ pdf-lib 读取
                        │
                   Canvas 渲染水印文字 → PNG
                        │
                   pdf-lib 叠加 PNG 水印
                        │
                   保留矢量 + 中文水印
```

---

## 5. 画布UI显示模块

### 功能描述
水印属性面板（输入 x/y/scale/rotation/opacity/font/color）、变换手柄（拖拽/缩放/旋转）、方案加载/保存。

### 前端文件
- `client/src/components/canvas/Canvas.jsx` - 主画布组件
- `client/src/components/canvas/PropertyPanel.jsx` - 属性面板
- `client/src/components/canvas/TransformHandles.jsx` - 变换手柄
- `client/src/components/canvas/FontSelector.jsx` - 字体选择器
- `client/src/hooks/useCanvas.js` - 画布交互 Hook

### 变换手柄设计
```
           ┌──────旋转手柄──────┐
           │          ▲         │
           │          │         │
      ┌────┼──────────┼────────┼────┐
      │    │          │        │    │
      │    │        水印       │    │  ← 缩放手柄（四角）
      │ ◄─┼────────────────────┼─► │
      │    │          │        │    │
      └────┼──────────┼────────┼────┘
           │          │         │
           │          ▼         │
           └───────────────────┘
```

### 交互处理 (useCanvas.js)
- `handleMouseDown('move', pos)` - 开始拖拽移动
- `handleMouseDown('resize', pos, handleId)` - 开始缩放
- `handleMouseDown('rotate', pos)` - 开始旋转
- 鼠标移动时更新 `watermark.x/y/scale/rotation`
- 所有坐标为相对值 (0-1)，存储在 appStore.watermark

### 属性面板 (PropertyPanel.jsx)
- X/Y: 相对坐标 (0-1)
- Scale: 缩放比例 (0-1)
- Rotation: 旋转角度 (度)
- Opacity: 透明度 (0-1)
- Font: 字体选择
- Color: 颜色选择

---

## 6. 水印方案管理模块

### 功能描述
保存、加载、导入、导出、删除水印方案。区分预设方案(首页可见)和普通方案。

### 前端文件
- `client/src/components/schemes/SchemeList.jsx` - 方案列表页面
- `client/src/components/schemes/SchemeSaveModal.jsx` - 保存方案弹窗
- `client/src/components/schemes/SchemeImportModal.jsx` - 导入方案弹窗

### 后端文件
- `server/src/routes/watermark.js` - 水印方案路由

### 方案数据结构
```json
{
  "id": "scheme_xxx",
  "name": "仅供内部使用",
  "isPreset": true,
  "userId": "admin",
  "createdAt": "2026-01-01T00:00:00Z",
  "watermark": {
    "text": "仅供XX业务使用",
    "x": 0.5,
    "y": 0.5,
    "scale": 0.5,
    "rotation": 45,
    "opacity": 0.8,
    "font": "黑体",
    "color": "#808080"
  }
}
```

### 存储位置
- `users/{userId}/schemes/{schemeId}.json`
- 预设和普通方案共用 schemes/ 目录，用 `isPreset` 字段区分

### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/watermark/schemes | 获取方案列表 |
| GET | /api/watermark/schemes/:id | 获取方案详情 |
| POST | /api/watermark/schemes | 创建方案 |
| PUT | /api/watermark/schemes/:id | 更新方案 |
| DELETE | /api/watermark/schemes/:id | 删除方案 |
| POST | /api/watermark/schemes/export/:id | 导出方案 |
| POST | /api/watermark/schemes/import | 导入方案 |

### 方案类型
| 类型 | 首页可见 | 画布加载 |
|------|----------|----------|
| 预设方案 (isPreset=true) | 是 | 是 |
| 普通方案 (isPreset=false) | 否 | 是 |

---

## 7. 水印文件处理和导出模块

### 功能描述
后端批量处理文件水印、生成 PDF/ZIP、任务状态跟踪。

### 后端文件
- `server/src/routes/process.js` - 处理路由
- `server/src/services/watermarkEngine.js` - 水印处理引擎
- `server/src/services/pdfRenderer.js` - Canvas 渲染服务（统一处理 PDF 和图片）

### 处理流程
```
POST /api/process/watermark
  → watermarkEngine.processBatch(filePaths, watermark, exportConfig)
    → 对每个文件:
      → 根据类型调用 pdfRenderer.addWatermarkToPdf() 或 addWatermarkToImage()
      → 生成输出文件名（按命名规则）
      → 保存到 exports/{taskId}/
    → 返回 taskId
```

### 文件类型支持
| 类型 | 处理方式 |
|------|----------|
| PDF | pdf-lib 添加 SVG Path 水印 |
| JPG/PNG | 转为 PDF 后添加水印 |

### 命名规则
| 规则 | 输出格式 |
|------|----------|
| original | 原名.pdf |
| timestamp | 原名_时间戳.pdf |
| text | 原名_水印文字.pdf |
| timestamp_text | 原名_时间戳_水印文字.pdf |

### 任务状态存储
使用内存 Map 存储任务状态（24小时过期）：
```javascript
{
  taskId: "task_2026-01-01T00-00-00",
  status: "completed",  // processing | completed
  total: 3,
  processed: 3,
  results: [
    { fileId: "doc_xxx", status: "success", outputPath: "task_xxx/身份证.pdf" }
  ]
}
```

### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/process/watermark | 批量处理 |
| GET | /api/process/status/:taskId | 查询状态 |
| GET | /api/process/download/:taskId | 下载结果 |
| DELETE | /api/process/cleanup | 清理过期文件 |

### 导出目录
- `exports/{taskId}/` - 临时导出目录，24小时后自动清理

---

## 水印参数说明

所有水印参数使用相对值 (0-1 范围)：

| 参数 | 含义 | 范围 |
|------|------|------|
| x | 水印中心点 X 坐标（相对背景宽度） | 0-1 |
| y | 水印中心点 Y 坐标（相对背景高度） | 0-1 |
| scale | 字体大小相对背景宽度的比例 | 0-1 |
| rotation | 旋转角度（度） | 0-360 |
| opacity | 透明度 | 0-1 |

### 计算公式
```javascript
// 实际像素位置
const pixelX = backgroundWidth * watermark.x;
const pixelY = backgroundHeight * watermark.y;

// 字体大小 = 背景宽度 × scale
const fontSize = backgroundWidth * watermark.scale;
```

---

## 目录结构

```
fastwm/
├── server/
│   └── src/
│       ├── routes/        # API 路由
│       ├── services/      # 业务逻辑 (watermarkEngine, pdfRenderer)
│       ├── middleware/     # 认证中间件
│       ├── utils/         # 工具函数 (fileManager, cleanup, response)
│       └── config/        # 配置
│
├── client/
│   └── src/
│       ├── components/   # React 组件（按模块组织）
│       ├── hooks/         # 自定义 Hooks
│       ├── stores/        # Zustand 状态管理
│       ├── api/           # Axios API 客户端
│       └── utils/         # 前端工具 (watermarkRenderer, pdfRenderer)
│
├── backgrounds/           # 上传的背景文件
├── documents/            # 证件文档存储
├── exports/              # 导出的水印文件
├── fonts/                # 字体文件 (TTF/OTF)
├── users/                # 用户数据
└── docs/                 # 文档
```

---

## 关键约束

### 字体格式
- **仅支持 TTF/OTF**，不支持 TTC
- Windows 字体目录：`C:\Windows\Fonts\`
- 常用字体：`simhei.ttf` (黑体), `simkai.ttf` (楷体)

### 水印渲染一致性
- 前端预览和后端导出使用相同的 scale 计算公式
- 公式：`scaleFactor = canvasWidth * watermark.scale / pathData.totalWidth`

### 用户数据隔离
- 每个用户数据存储在独立目录 `users/{userId}/`
- 证件文档 `documents/` 为共享目录

---

## 测试

| 层级 | 框架 | 命令 |
|------|------|------|
| 后端测试 | Vitest | `cd server && npm test` |
| 前端单元测试 | Vitest | `cd client && npm test` |
| E2E 测试 | Playwright | `cd client && npm run test:e2e` |

---

## 快速命令

```bash
# 后端开发
cd server && npm install
cd server && npm run dev    # http://localhost:3000

# 前端开发
cd client && npm install
cd client && npm run dev    # http://localhost:5173
```
