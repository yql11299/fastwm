/**
 * PDF 渲染服务
 * 混合方案：pdf-lib 保持 PDF 矢量 + Canvas 渲染水印文字叠加
 *
 * 水印参数说明：
 * - x, y: 水印中心点坐标 (0-1，相对值)
 * - scale: 字体大小 (0-1，相对于背景宽度的比例，如 0.05 表示字体大小为背景宽度的 5%)
 * - rotation: 旋转角度 (度)
 * - opacity: 透明度 (0-1)
 * - font: 字体名称
 * - color: 颜色 (#RRGGBB)
 *
 * 渲染一致性：
 * - 使用 watermarkRenderer.js 中的统一 Path2D 渲染逻辑
 * - 前后端渲染效果保持一致
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { renderWatermarkToCanvas as renderWatermark } from './watermarkRenderer.js';

// pdfjs-dist 需要 DOMMatrix (浏览器 API)，在 Node.js 中需要 polyfill
// canvas 包提供了 DOMMatrix 实现
import { createCanvas, DOMMatrix } from 'canvas';
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = DOMMatrix;
}

// 动态导入 pdfjs-dist（在 DOMMatrix polyfill 之后）
const pdfjs = await import('pdfjs-dist');

// 设置 pdfjs-dist 的 workerSrc（使用 CDN）
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/**
 * 从文件路径检测图片类型
 * @param {string} filePath - 文件路径
 * @returns {string}
 */
function detectImageType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    '.jpg': 'jpeg',
    '.jpeg': 'jpeg',
    '.png': 'png',
  };
  return typeMap[ext] || 'jpeg';
}

/**
 * 将 hex 颜色转换为 RGB
 * @param {string} hex - 十六进制颜色
 * @returns {Object} { r, g, b }
 */
function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return { r, g, b };
}

/**
 * 在 Canvas 上渲染水印文字，返回 PNG 图像数据
 * 使用 watermarkRenderer 的统一渲染逻辑
 *
 * @param {Object} watermark - 水印参数
 * @param {number} width - Canvas 宽度
 * @param {number} height - Canvas 高度
 * @returns {Promise<{canvas: Object, width: number, height: number}>}
 */
async function renderWatermarkToCanvas(watermark, width, height) {
  return renderWatermark(watermark, width, height, config.dirs.fonts);
}

/**
 * 为图片添加水印并创建 PDF
 * @param {string} imagePath - 图片文件路径
 * @param {Object} watermark - 水印参数
 * @returns {Promise<Buffer>} PDF 文件 buffer
 */
async function addWatermarkToImage(imagePath, watermark) {
  // 读取图片文件
  const imageBuffer = await fs.readFile(imagePath);
  const imageType = detectImageType(imagePath);

  // 创建 PDF 文档
  const pdfDoc = await PDFDocument.create();

  // 嵌入图片
  let embeddedImage;
  if (imageType === 'jpeg') {
    embeddedImage = await pdfDoc.embedJpg(imageBuffer);
  } else if (imageType === 'png') {
    embeddedImage = await pdfDoc.embedPng(imageBuffer);
  } else {
    throw new Error(`不支持的图片格式: ${imageType}`);
  }

  const width = embeddedImage.width;
  const height = embeddedImage.height;

  // 创建页面
  const page = pdfDoc.addPage([width, height]);

  // 绘制原图
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  // 渲染水印到 Canvas
  const { canvas: watermarkCanvas } = await renderWatermarkToCanvas(watermark, width, height);

  // 将 Canvas 转为 PNG
  const watermarkImageData = watermarkCanvas.toBuffer('image/png');

  // 嵌入水印图像
  const watermarkImage = await pdfDoc.embedPng(watermarkImageData);

  // 叠加水印图像（透明背景会自动混合）
  page.drawImage(watermarkImage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  return Buffer.from(await pdfDoc.save());
}

/**
 * 为图片添加水印，导出为指定格式（PNG/JPG/原格式）
 * 统一使用 canvas 渲染：原图 + 水印 → canvas → 按需导出格式
 * @param {string} imagePath - 图片文件路径
 * @param {Object} watermark - 水印参数
 * @param {string} fontDir - 字体目录
 * @param {string} outputMimeType - 输出 MIME 类型 ('image/png', 'image/jpeg')
 * @returns {Promise<Buffer>} 图片 buffer
 */
async function addWatermarkToImageCanvas(imagePath, watermark, fontDir, outputMimeType) {
  const { createCanvas, loadImage } = await import('canvas');

  // 读取图片文件
  const imageBuffer = await fs.readFile(imagePath);

  // 加载图片
  const img = await loadImage(imageBuffer);
  const width = img.width;
  const height = img.height;

  // 创建输出 canvas
  const outputCanvas = createCanvas(width, height);
  const ctx = outputCanvas.getContext('2d');

  // 绘制原图
  ctx.drawImage(img, 0, 0, width, height);

  // 渲染水印到 Canvas
  const { canvas: watermarkCanvas } = await renderWatermark(watermark, width, height, fontDir);

  // 将水印绘制到原图上
  ctx.drawImage(watermarkCanvas, 0, 0, width, height);

  // 返回图片 buffer
  return Buffer.from(outputCanvas.toBuffer(outputMimeType));
}

/**
 * 为图片添加水印，保持原图片格式（JPG/PNG）
 * @param {string} imagePath - 图片文件路径
 * @param {Object} watermark - 水印参数
 * @param {string} fontPath - 字体文件路径
 * @returns {Promise<Buffer>} 图片 buffer (jpg 或 png)
 */
async function addWatermarkToImageAsOriginal(imagePath, watermark, fontPath) {
  const fontDir = path.dirname(fontPath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  return addWatermarkToImageCanvas(imagePath, watermark, fontDir, mimeType);
}

/**
 * 为图片添加水印并导出为 PNG
 * @param {string} imagePath - 图片文件路径
 * @param {Object} watermark - 水印参数
 * @param {string} fontPath - 字体文件路径
 * @returns {Promise<Buffer>} PNG 文件 buffer
 */
async function addWatermarkToImagePNG(imagePath, watermark, fontPath) {
  const fontDir = path.dirname(fontPath);
  return addWatermarkToImageCanvas(imagePath, watermark, fontDir, 'image/png');
}

/**
 * 为 PDF 添加水印并导出为 PNG
 * 使用 pdfjs-dist 将 PDF 页面渲染到 canvas，然后叠加水印
 * @param {string} pdfPath - PDF 文件路径
 * @param {Object} watermark - 水印参数
 * @param {string} fontPath - 字体文件路径
 * @returns {Promise<Buffer>} PNG 文件 buffer (只处理第一页)
 */
async function addWatermarkToPdfPNG(pdfPath, watermark, fontPath) {
  // 读取 PDF 文件
  const pdfBuffer = await fs.readFile(pdfPath);

  // 使用 pdfjs-dist v5 API 加载 PDF
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  // 获取第一页
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });

  const width = viewport.width;
  const height = viewport.height;

  // 创建输出 canvas
  const { createCanvas } = await import('canvas');
  const outputCanvas = createCanvas(width, height);
  const ctx = outputCanvas.getContext('2d');

  // 使用 pdfjs-dist 渲染 PDF 到 canvas
  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  // 渲染水印到 Canvas
  const fontDir = path.dirname(fontPath);
  const { canvas: watermarkCanvas } = await renderWatermark(watermark, width, height, fontDir);

  // 将水印绘制到 PDF 页面上
  ctx.drawImage(watermarkCanvas, 0, 0, width, height);

  // 返回 PNG buffer
  return Buffer.from(outputCanvas.toBuffer('image/png'));
}

/**
 * 为 PDF 添加水印（保持矢量内容）
 * @param {string} pdfPath - PDF 文件路径
 * @param {Object} watermark - 水印参数
 * @returns {Promise<Buffer>} 处理后的 PDF buffer
 */
async function addWatermarkToPdf(pdfPath, watermark) {
  // 读取 PDF 文件
  const pdfBuffer = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // 获取页面列表
  const pages = pdfDoc.getPages();
  const numPages = pages.length;
  console.log(`[pdfRenderer] PDF 共有 ${numPages} 页`);

  // 对每一页进行处理
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    console.log(`[pdfRenderer] 处理第 ${i + 1} 页，尺寸: ${width}x${height}`);

    // 渲染水印到 Canvas
    const { canvas: watermarkCanvas } = await renderWatermarkToCanvas(watermark, width, height);

    // 将 Canvas 转为 PNG
    const watermarkImageData = watermarkCanvas.toBuffer('image/png');

    // 嵌入水印图像
    const watermarkImage = await pdfDoc.embedPng(watermarkImageData);

    // 叠加水印图像到页面
    page.drawImage(watermarkImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

/**
 * 批量处理文件添加水印
 * @param {Array<string>} filePaths - 文件路径列表
 * @param {Object} watermark - 水印参数
 * @param {Object} exportConfig - 导出配置
 * @returns {Promise<Object>}
 */
async function batchProcessFiles(filePaths, watermark, exportConfig) {
  const results = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const taskId = `task_${timestamp}`;

  const exportDir = path.join(config.dirs.exports, taskId);
  await fs.mkdir(exportDir, { recursive: true });

  for (const filePath of filePaths) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let outputBuffer;

      if (ext === '.pdf') {
        outputBuffer = await addWatermarkToPdf(filePath, watermark);
      } else {
        outputBuffer = await addWatermarkToImage(filePath, watermark);
      }

      const baseName = path.basename(filePath, ext);
      let outputName;

      switch (exportConfig.namingRule) {
        case 'original':
          outputName = `${baseName}.pdf`;
          break;
        case 'timestamp':
          outputName = `${baseName}_${timestamp}.pdf`;
          break;
        case 'text':
          outputName = `${baseName}_${watermark.text}.pdf`;
          break;
        case 'timestamp_text':
        default:
          outputName = `${baseName}_${timestamp}_${watermark.text}.pdf`;
          break;
      }

      const outputPath = path.join(exportDir, outputName);
      await fs.writeFile(outputPath, outputBuffer);

      results.push({
        fileId: path.basename(filePath),
        status: 'success',
        outputPath: path.join(taskId, outputName),
      });
    } catch (error) {
      console.error(`[pdfRenderer] 处理文件失败 ${filePath}:`, error);
      results.push({
        fileId: path.basename(filePath),
        status: 'failed',
        error: error.message,
      });
    }
  }

  return {
    taskId,
    results,
    exportDir,
  };
}

/**
 * 创建带水印的 PDF
 * @param {Object} watermark - 水印参数
 * @param {number} width - 页面宽度
 * @param {number} height - 页面高度
 * @returns {Promise<Buffer>}
 */
async function createWatermarkedPdf(watermark, width = 595, height = 842) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([width, height]);

  // 渲染水印到 Canvas
  const { canvas: watermarkCanvas } = await renderWatermarkToCanvas(watermark, width, height);

  // 将 Canvas 转为 PNG
  const watermarkImageData = watermarkCanvas.toBuffer('image/png');

  // 嵌入水印图像
  const watermarkImage = await pdfDoc.embedPng(watermarkImageData);

  // 叠加水印图像
  page.drawImage(watermarkImage, {
    x: 0,
    y: 0,
    width,
    height,
  });

  return Buffer.from(await pdfDoc.save());
}

export default {
  addWatermarkToImage,
  addWatermarkToImagePNG,
  addWatermarkToImageAsOriginal,
  addWatermarkToPdf,
  addWatermarkToPdfPNG,
  batchProcessFiles,
  createWatermarkedPdf,
  hexToRgb,
  detectImageType,
};
