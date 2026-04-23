/**
 * 生成测试用空白 JPG/PNG 图片
 *
 * 使用方法:
 *   node generate-test-images.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 最小有效 JPEG (1x1 白色像素) - base64 编码
// 这是最小的有效 JPEG 文件格式
const MINIMAL_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==';

async function generateTestImages() {
  // 生成空白 JPG (使用 pdf-lib 创建后转为 jpeg 其实较复杂，直接用预定义的最小有效 JPEG)

  // 创建测试用 JPG - 100x100 白色图像的 base64
  // 这个是一个简单的 100x100 白色 JPEG
  const whiteJpgBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==';

  await fs.writeFile(path.join(__dirname, 'test-image.jpg'), Buffer.from(whiteJpgBase64, 'base64'));
  console.log('Generated test-image.jpg (1x1 white pixel)');

  // 对于 PNG，使用简单的空图片
  // 最小有效 PNG (1x1 透明像素)
  const minimalPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // 8-bit RGBA
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0x00, 0x00, 0x00, 0x02, // compressed data
    0x00, 0x01, 0xE2, 0x21, 0xBC, 0x00, 0x00, 0x00, // IEND chunk
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, //
  ]);

  await fs.writeFile(path.join(__dirname, 'test-image.png'), minimalPng);
  console.log('Generated test-image.png (1x1 transparent pixel)');

  console.log('\nAll test images generated successfully!');
}

generateTestImages().catch(console.error);
