# 测试用 Fixtures

本目录包含水印处理模块测试所需的文件 fixtures。

## 文件说明

| 文件 | 描述 | 尺寸 |
|------|------|------|
| `blank-a4.pdf` | 空白 A4 PDF | 595 x 842 points |
| `blank-letter.pdf` | 空白 Letter PDF | 612 x 792 points |
| `blank-a3.pdf` | 空白 A3 PDF | 842 x 1191 points |
| `test-image.jpg` | 测试用红色 JPEG | 100 x 100 pixel |
| `test-image.png` | 测试用白色 PNG | 100 x 100 pixel |

## 生成脚本

如果需要重新生成测试文件，运行：

```bash
# 生成空白 PDF
node tests/fixtures/generate-blank-pdfs.mjs

# 生成测试图片
node tests/fixtures/generate-test-images.mjs
```

## 依赖

生成脚本依赖：
- `pdf-lib` - 用于生成空白 PDF
- `jimp` - 用于生成测试图片

```bash
npm install pdf-lib jimp
```
