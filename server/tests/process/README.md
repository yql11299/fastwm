# 水印处理模块测试文档

## 概述

本文档描述水印处理模块的测试策略、测试用例及运行方法。

## 测试范围

| 模块 | 测试文件 | 描述 |
|------|----------|------|
| 水印引擎单元测试 | `unit/watermarkEngine.test.js` | 任务管理、文件类型识别、批量处理 |
| PDF渲染服务单元测试 | `unit/pdfRenderer.test.js` | 颜色转换、图片检测、水印添加 |
| 文字转Path单元测试 | `unit/textToPath.test.js` | SVG Path生成、字体加载、缩放计算 |
| 处理路由集成测试 | `integration/process.test.js` | 所有处理 API 端点 |

## 测试启动方法

### 前置条件

```bash
cd server
npm install
```

### 运行所有水印处理测试

```bash
cd server
npm test -- --testPathPattern="process"
```

### 仅运行单元测试

```bash
npm test -- --testPathPattern="process/unit"
```

### 仅运行集成测试

```bash
npm test -- --testPathPattern="process/integration"
```

### 生成覆盖率报告

```bash
npm test -- --testPathPattern="process" --coverage
```

## 文件结构

```
tests/process/
├── README.md           # 本文档
├── setup.js           # 测试环境配置和辅助函数
├── fixtures/           # 测试用文件
│   ├── README.md
│   ├── generate-blank-pdfs.mjs
│   ├── generate-test-images.mjs
│   ├── blank-a4.pdf    # 595x842 points
│   ├── blank-letter.pdf # 612x792 points
│   ├── blank-a3.pdf    # 842x1191 points
│   ├── test-image.jpg
│   └── test-image.png
├── unit/
│   ├── watermarkEngine.test.js  # 水印引擎测试
│   ├── pdfRenderer.test.js       # PDF渲染测试
│   └── textToPath.test.js        # 文字转Path测试
└── integration/
    └── process.test.js           # API集成测试
```

---

## 单元测试用例

### 1. watermarkEngine.test.js (20 个测试)

#### generateTaskId - 任务ID生成

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-ENGINE-UT-001 | 应该生成有效的任务ID | 验证ID非空 | `toBeDefined()`, `typeof === 'string'` |
| TC-ENGINE-UT-002 | 任务ID应该以 task_ 开头 | 验证ID格式 | `startsWith('task_')` |
| TC-ENGINE-UT-003 | 任务ID格式应该正确 | 验证时间戳格式 | `match(/^task_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/)` |
| TC-ENGINE-UT-004 | 每次调用应该生成不同的任务ID | 验证唯一性 | 每次生成格式正确 |

#### getFileType - 文件类型识别

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-ENGINE-UT-005 | 应该正确识别 PDF 文件 | 验证PDF识别 | `getFileType('file.pdf') === 'pdf'` |
| TC-ENGINE-UT-006 | 应该正确识别 JPG 图片文件 | 验证JPG识别 | `getFileType('file.jpg') === 'image'` |
| TC-ENGINE-UT-007 | 应该正确识别 PNG 图片文件 | 验证PNG识别 | `getFileType('file.png') === 'image'` |
| TC-ENGINE-UT-008 | 应该正确识别未知文件类型 | 验证未知类型 | `getFileType('file.txt') === 'unknown'` |
| TC-ENGINE-UT-009 | 应该处理没有扩展名的文件 | 验证无扩展名 | `getFileType('filename') === 'unknown'` |
| TC-ENGINE-UT-010 | 应该处理带路径的文件名 | 验证路径处理 | Windows/Unix路径正确识别 |

#### getTask / createTask - 任务管理

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-ENGINE-UT-011 | 应该能创建并获取任务 | 验证创建功能 | task对象包含 `taskId`, `status`, `total` |
| TC-ENGINE-UT-012 | 应该能通过 getTask 获取任务 | 验证获取功能 | 获取的任务ID匹配 |
| TC-ENGINE-UT-013 | 应该返回 null 当任务不存在 | 验证不存在处理 | `getTask('invalid') === null` |
| TC-ENGINE-UT-014 | updateTaskProgress 应该正确更新进度 | 验证进度更新 | processed递增，status变化 |

#### processBatch - 批量文件处理

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-ENGINE-UT-015 | 应该成功处理空白 PDF 并返回任务信息 | 验证PDF处理 | `status === 'completed'`, `results[0].status === 'success'` |
| TC-ENGINE-UT-016 | 应该处理多个文件 | 验证批量处理 | `total === 2`, `processed === 2` |
| TC-ENGINE-UT-017 | 应该使用 original 命名规则 | 验证命名规则 | 输出文件名包含原名 |
| TC-ENGINE-UT-018 | 应该使用 timestamp_text 命名规则 | 验证复合命名 | 输出文件名包含时间戳和水印文字 |
| TC-ENGINE-UT-019 | 应该处理 JPG 图片文件 | 验证JPG处理 | `results[0].status === 'success'` |
| TC-ENGINE-UT-020 | 应该处理 PNG 图片文件 | 验证PNG处理 | `results[0].status === 'success'` |

---

### 2. pdfRenderer.test.js (19 个测试)

#### hexToRgb - 颜色转换

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-PDF-UT-001 | 应该正确解析 6 位十六进制颜色 | 验证颜色解析 | `#808080` → `r,g,b` 在 0-1 范围 |
| TC-PDF-UT-002 | 应该正确解析 #FFFFFF 格式 | 验证全白解析 | r=g=b=1 |
| TC-PDF-UT-003 | 应该正确解析带 # 前缀的颜色 | 验证前缀处理 | `#FF0000` → r=1, g=0, b=0 |
| TC-PDF-UT-004 | 应该正确解析无 # 前缀的颜色 | 验证无前缀处理 | `00FF00` → r=0, g=1, b=0 |
| TC-PDF-UT-005 | 解析结果应该是 0-1 范围的值 | 验证范围 | 所有分量在 [0,1] 范围内 |

#### detectImageType - 图片类型检测

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-PDF-UT-006 | 应该正确识别 .jpg 扩展名 | 验证JPG类型 | `detectImageType('image.jpg') === 'jpeg'` |
| TC-PDF-UT-007 | 应该正确识别 .png 扩展名 | 验证PNG类型 | `detectImageType('image.png') === 'png'` |
| TC-PDF-UT-008 | 应该对未知扩展名返回默认 jpeg | 验证默认处理 | 未知类型返回 `'jpeg'` |
| TC-PDF-UT-009 | 应该忽略大小写 | 验证大小写处理 | 大写扩展名正确识别 |

#### addWatermarkToPdf - PDF水印添加

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-PDF-UT-010 | 应该成功处理空白 A4 PDF 并返回 buffer | 验证基本功能 | `result instanceof Uint8Array`, 结果以 `%PDF-` 开头 |
| TC-PDF-UT-011 | 应该正确处理不同水印位置参数 | 验证位置参数 | 左上角、右下角等位置正确应用 |
| TC-PDF-UT-012 | 应该正确处理水印旋转 | 验证旋转效果 | 45度旋转成功生成 |
| TC-PDF-UT-013 | 应该正确处理透明度 | 验证透明度 | 半透明、完全透明都能处理 |
| TC-PDF-UT-014 | scale=0.1 时水印宽度应为页面宽度的 10% | 验证缩放计算 | A4宽度595points的10%=59.5points |
| TC-PDF-UT-015 | 应该处理 Letter 尺寸 PDF | 验证尺寸适配 | Letter尺寸(612x792)正确处理 |
| TC-PDF-UT-016 | 应该处理空文字水印（使用默认文字） | 验证空文字处理 | 空文字水印不报错 |

#### addWatermarkToImage - 图片水印添加

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-PDF-UT-017 | 应该将 JPG 图片转换为带水印的 PDF | 验证JPG转换 | 输出是PDF格式 (`%PDF-` 开头) |
| TC-PDF-UT-018 | 应该将 PNG 图片转换为带水印的 PDF | 验证PNG转换 | 输出是PDF格式 |
| TC-PDF-UT-019 | 应该正确应用水印位置到图片 | 验证位置应用 | 左上角等位置正确 |

---

### 3. textToPath.test.js (17 个测试)

#### getMergedPath - 文字转 SVG Path

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-TEXT-UT-001 | 应该将单个汉字转换为 SVG path | 验证基本转换 | 返回有效的 `mergedPathData` |
| TC-TEXT-UT-002 | 应该将多个汉字合并为单一路径 | 验证多字合并 | `mergedPathData.length > 0` |
| TC-TEXT-UT-003 | 应该处理空字符串 | 验证空字符串 | `mergedPathData === ''`, `totalWidth === 0` |
| TC-TEXT-UT-004 | 不同字体应返回不同路径 | 验证字体差异 | 黑体和楷体的路径数据不同 |
| TC-TEXT-UT-005 | 相同字体和文字应返回相同路径 | 验证一致性 | 相同输入返回相同输出 |
| TC-TEXT-UT-006 | simkai 字体（楷体）应该可用 | 验证楷体支持 | 能成功获取楷体路径 |

#### scale 计算验证

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-TEXT-UT-007 | scale=0.1 时 finalScaleFactor 计算正确 | 验证缩放公式 | `scaleFactor = pageWidth * 0.1 / totalWidth` |
| TC-TEXT-UT-008 | totalWidth 应该与 baseSize 相关 | 验证线性缩放 | baseSize加倍，totalWidth约加倍 |
| TC-TEXT-UT-009 | 字符越多 totalWidth 越大 | 验证宽度累积 | 更多字符产生更宽路径 |
| TC-TEXT-UT-010 | totalHeight 应该反映字体大小 | 验证高度计算 | `totalHeight > 0` |

#### generateSvgPath - SVG Path 生成

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-TEXT-UT-011 | 应该生成有效的 SVG 字符串 | 验证SVG格式 | 包含 `<svg>` 和 `</svg>` 标签 |
| TC-TEXT-UT-012 | 应该处理空文字返回 null | 验证空输入 | `generateSvgPath('') === null` |
| TC-TEXT-UT-013 | 应该正确设置 transform 属性 | 验证变换属性 | 包含 `rotate()` 和 `translate()` |
| TC-TEXT-UT-014 | 返回值应该包含宽高信息 | 验证尺寸返回 | `width > 0`, `height > 0` |

#### getAvailableFonts - 可用字体列表

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-TEXT-UT-014 | 应该返回字体数组 | 验证字体列表 | 返回数组且长度 > 0 |
| TC-TEXT-UT-015 | 字体对象应该有必要的属性 | 验证字体结构 | 每个字体有 `name` 和 `file` 属性 |
| TC-TEXT-UT-016 | simhei 字体（黑体）应该可用 | 验证黑体 | `fonts` 包含 simhei |
| TC-TEXT-UT-017 | simkai 字体（楷体）应该可用 | 验证楷体 | `fonts` 包含 simkai |

---

## 集成测试用例 (17 个)

### 测试文件: `integration/process.test.js`

#### 1. POST /api/process/watermark - 批量水印处理

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-PROCESS-IT-001 | 应该返回 401 当未提供认证 | 验证认证要求 | `res.status === 401` |
| TC-PROCESS-IT-002 | 应该返回 400 当 schemeId 为空 | 验证 schemeId 必填 | `res.status === 400` |
| TC-PROCESS-IT-003 | 应该返回 400 当 fileIds 为空数组 | 验证 fileIds 必填 | `res.status === 400` |
| TC-PROCESS-IT-004 | 应该返回 400 当 fileIds 不是数组 | 验证 fileIds 类型 | `res.status === 400` |
| TC-PROCESS-IT-005 | 应该返回 400 当水印文字为空且方案中也没有文字 | 验证文字必填 | `res.status === 400` |
| TC-PROCESS-IT-006 | 应该返回 400 当文件数量超过限制 | 验证文件数量限制 | `res.body.error.code === 'TOO_MANY_FILES'` |
| TC-PROCESS-IT-007 | 应该返回 404 当文件不存在 | 验证文件存在性检查 | `res.status === 404` |
| TC-PROCESS-IT-008 | 应该返回 404 当方案不存在 | 验证方案存在性检查 | `res.status === 404` |
| TC-PROCESS-IT-009 | 应该使用 text 参数覆盖方案中的水印文字 | 验证文字覆盖 | 覆盖后的文字被使用 |
| TC-PROCESS-IT-010 | 应该使用方案中的默认值当 text 参数为空 | 验证空 text 处理 | 使用方案原有文字 |
| TC-PROCESS-IT-011 | 应该使用方案中的完整水印配置 | 验证完整配置应用 | 配置被正确读取 |
| TC-PROCESS-IT-012 | 应该接受带 exportConfig 的请求 | 验证导出配置传递 | 请求格式正确 |

#### 2. GET /api/process/status/:taskId - 查询处理状态

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-PROCESS-IT-013 | 应该返回 401 当未提供认证 | 验证认证要求 | `res.status === 401` |
| TC-PROCESS-IT-014 | 应该返回 404 当任务不存在 | 验证任务查询 | `res.status === 404` |

#### 3. GET /api/process/download/:taskId - 下载处理结果

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-PROCESS-IT-015 | 应该返回 401 当未提供认证 | 验证认证要求 | `res.status === 401` |
| TC-PROCESS-IT-016 | 应该返回 404 当任务不存在 | 验证下载端点 | `res.status === 404` |

#### 4. DELETE /api/process/cleanup - 清理临时文件

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-PROCESS-IT-017 | 应该返回 401 当未提供认证 | 验证认证要求 | `res.status === 401` |

---

## 测试数据清理

### 清理策略

1. **beforeEach**: 每个集成测试前清理 `test_users` 目录
2. **afterAll**: 所有测试结束后清理所有测试数据

### 辅助函数

位于 `setup.js`:

```javascript
import { createTestScheme, cleanupTestUsers, cleanupAllTestData } from './setup.js';

// 创建测试方案
await createTestScheme(userId, schemeId, watermarkConfig);

// 清理测试用户
await cleanupTestUsers();

// 清理所有测试数据
await cleanupAllTestData();
```

### createTestScheme 参数说明

```javascript
// 基本用法
await createTestScheme('test_user', 'scheme_001');

// 自定义水印配置
await createTestScheme('test_user', 'scheme_001', {
  text: '自定义水印文字',
  x: 0.3,
  y: 0.7,
  scale: 0.1,
  rotation: 45,
  opacity: 0.5,
  font: '楷体',
  color: '#FF0000',
  isPreset: true,
  name: '我的方案',
});
```

---

## API 参数说明

### POST /api/process/watermark

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| schemeId | string | 是 | 水印方案ID |
| text | string | 否 | 水印文字（覆盖方案中的文字） |
| fileIds | array | 是 | 要处理的文件ID数组 |
| exportConfig | object | 否 | 导出配置 |
| exportConfig.namingRule | string | 否 | 命名规则: original/timestamp/text/timestamp_text |
| exportConfig.quality | number | 否 | 输出质量 1-100 |

### 水印方案数据结构

```json
{
  "id": "scheme_001",
  "name": "测试方案",
  "isPreset": true,
  "userId": "test_user",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "watermark": {
    "text": "水印文字",
    "x": 0.5,
    "y": 0.5,
    "scale": 0.05,
    "rotation": 0,
    "opacity": 0.8,
    "font": "黑体",
    "color": "#808080"
  }
}
```

### 水印参数范围

| 参数 | 范围 | 说明 |
|------|------|------|
| x | 0-1 | 水印中心X坐标（相对背景宽度） |
| y | 0-1 | 水印中心Y坐标（相对背景高度） |
| scale | 0-1 | 水印宽度相对背景宽度的比例（默认0.05=5%） |
| rotation | 0-360 | 旋转角度（度） |
| opacity | 0-1 | 透明度 |

---

## 测试统计

| 类型 | 测试数量 |
|------|----------|
| watermarkEngine 单元测试 | 20 |
| pdfRenderer 单元测试 | 19 |
| textToPath 单元测试 | 17 |
| 集成测试 | 17 |
| **总计** | **73** |

---

## 常见问题

### Q: 集成测试失败显示方案不存在

A: 确保 `beforeEach` 中的清理函数正确执行，并且 `createTestScheme` 在测试请求前被调用。

### Q: 文字覆盖测试失败

A: 确认测试中创建方案时设置了正确的 `text` 值，并且请求中的 `text` 参数能正确覆盖。

### Q: 文件数量限制测试失败

A: 检查 `config.limits.maxFilesPerBatch` 的配置值，测试中使用 101 个文件应触发限制。

### Q: pdfRenderer 测试中字体路径错误

A: 确保 `FONTS_PATH` 环境变量指向包含 `simhei.ttf` 和 `simkai.ttf` 的目录。
