/**
 * 测试数据生成器
 *
 * 用途: 生成空白测试文档用于水印功能测试
 * 运行方式: cd watermark-verify && node generate-blank.js
 *
 * 依赖: pdf-lib, jimp (来自 watermark-verify/node_modules)
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'blank-test-data');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============ 测试文档规格 ============

// 证件文档规格 (单位: points, 1 point = 1/72 inch)
const ID_CARD = { width: 322, height: 203, name: 'id_card' };        // 身份证尺寸
const BUSINESS_LICENSE = { width: 450, height: 300, name: 'business_license' }; // 营业执照
const CONTRACT_A4 = { width: 595, height: 842, name: 'contract_a4' }; // 合同A4

// 图片规格 (单位: pixels)
const IMG_SMALL = { width: 640, height: 480, name: 'small' };
const IMG_MEDIUM = { width: 1280, height: 720, name: 'medium' };
const IMG_LARGE = { width: 1920, height: 1080, name: 'large' };

// ============ PDF 生成 ============

async function generateBlankPDF(spec, extension = 'pdf') {
  const pdfDoc = await PDFDocument.create();

  // 添加一页
  const page = pdfDoc.addPage([spec.width, spec.height]);

  // 绘制浅灰色背景以便识别
  page.drawRectangle({
    x: 0,
    y: 0,
    width: spec.width,
    height: spec.height,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 2,
  });

  // 添加标题文字
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const text = `${spec.name} - Blank Test Document`;

  page.drawText(text, {
    x: 10,
    y: spec.height - 20,
    size: fontSize,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // 保存
  const pdfBytes = await pdfDoc.save();
  const filename = `${spec.name}_${spec.width}x${spec.height}.${extension}`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), pdfBytes);
  console.log(`Created: ${filename}`);
}

// ============ 图片生成 ============

async function generateBlankImage(spec, format) {
  // 创建空白图片 (浅灰色背景)
  // Jimp v1.x uses options object
  const image = new Jimp({ width: spec.width, height: spec.height, color: 0xCCCCCCCC });

  // 添加简单边框
  const borderColor = 0x99999999;
  for (let x = 0; x < spec.width; x++) {
    for (let y = 0; y < 5; y++) {
      image.setPixelColor(borderColor, x, y);
      image.setPixelColor(borderColor, x, spec.height - 1 - y);
    }
  }
  for (let y = 0; y < spec.height; y++) {
    for (let x = 0; x < 5; x++) {
      image.setPixelColor(borderColor, x, y);
      image.setPixelColor(borderColor, spec.width - 1 - x, y);
    }
  }

  // 保存 (write 返回 Promise)
  const filename = `${spec.name}_${spec.width}x${spec.height}.${format}`;
  const filepath = path.join(OUTPUT_DIR, filename);
  await image.write(filepath);
  console.log(`Created: ${filename}`);
}

// ============ 主函数 ============

async function main() {
  console.log('========== Test Data Generator ==========\n');
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  console.log('Generating blank PDFs...');
  await generateBlankPDF(ID_CARD);
  await generateBlankPDF(BUSINESS_LICENSE);
  await generateBlankPDF(CONTRACT_A4);

  console.log('\nGenerating blank PNGs...');
  await generateBlankImage(IMG_SMALL, 'png');
  await generateBlankImage(IMG_MEDIUM, 'png');
  await generateBlankImage(IMG_LARGE, 'png');

  console.log('\nGenerating blank JPGs...');
  await generateBlankImage(IMG_SMALL, 'jpg');
  await generateBlankImage(IMG_MEDIUM, 'jpg');
  await generateBlankImage(IMG_LARGE, 'jpg');

  console.log('\n========== Generation Complete ==========');
}

main().catch(console.error);
