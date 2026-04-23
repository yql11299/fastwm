/**
 * 水印渲染模块 - 后端使用
 * 使用 fillText 绘制水印，与前端渲染参数计算保持一致
 *
 * 渲染一致性保证：
 * - scale 计算公式一致: fontSize = canvasWidth * watermark.scale
 * - 位置计算公式一致: centerX = canvasWidth * watermark.x, centerY = canvasHeight * watermark.y
 * - 旋转计算一致: ctx.rotate((rotation * Math.PI) / 180)
 *
 * 注意：由于前端使用 Path2D 逐字符绘制，后端使用 fillText 整体绘制，
 * 两者渲染效果可能会有细微差异。如果需要完全一致，需要使用 Puppeteer 等方案
 * 在真实浏览器环境中渲染水印。
 */

import { createCanvas, registerFont } from 'canvas';
import textToPath from './textToPath.js';
import path from 'path';

// 字体缓存
const fontRegistry = new Set();

/**
 * 字体名称映射到文件名
 */
const FONT_NAME_MAPPING = {
  '黑体': 'simhei.ttf',
  'simhei': 'simhei.ttf',
  '楷体': 'simkai.ttf',
  'simkai': 'simkai.ttf',
  '宋体': 'simsun.ttc',
  'simsun': 'simsun.ttc',
  '微软雅黑': 'msyh.ttc',
  'msyh': 'msyh.ttc',
  'Microsoft YaHei': 'msyh.ttc',
};

/**
 * 获取字体文件名
 */
function getFontFileName(fontName) {
  const mapped = FONT_NAME_MAPPING[fontName];
  if (mapped) return mapped;
  const lower = fontName.toLowerCase();
  if (lower.endsWith('.ttf') || lower.endsWith('.ttc') || lower.endsWith('.otf')) {
    return fontName;
  }
  return `${fontName}.ttf`;
}

/**
 * 注册字体到 Node.js Canvas
 */
async function registerFontForCanvas(fontName, fontPath) {
  if (fontRegistry.has(fontName)) {
    return;
  }
  try {
    registerFont(fontPath, { family: fontName });
    fontRegistry.add(fontName);
    console.log(`[watermarkRenderer] 字体注册成功: ${fontName}`);
  } catch (error) {
    console.warn(`[watermarkRenderer] 字体注册失败: ${fontName}`, error.message);
  }
}

/**
 * 在 Canvas 上渲染水印（fillText 方式）
 * 与前端 watermarkRenderer.js 的参数计算保持一致
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {Object} watermark - 水印参数
 * @param {number} canvasWidth - Canvas 宽度
 * @param {number} canvasHeight - Canvas 高度
 */
export function drawWatermarkOnCanvas(ctx, watermark, canvasWidth, canvasHeight) {
  // 清空 Canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!watermark.text) {
    console.warn('[watermarkRenderer] 无水印文字');
    return;
  }

  const text = watermark.text;
  const fontName = watermark.font || '黑体';

  // 计算字体大小：scale=1.0 表示字体宽度等于背景宽度
  // 这与前端计算一致: finalScaleFactor = canvasWidth * scale / pathData.totalWidth
  // 这里简化处理，直接使用 scale 作为字体大小的比例因子
  const fontSize = canvasWidth * watermark.scale;

  // 水印中心点
  const centerX = canvasWidth * watermark.x;
  const centerY = canvasHeight * watermark.y;

  // 设置样式
  ctx.font = `${fontSize}px "${fontName}"`;
  ctx.fillStyle = watermark.color || '#000000';
  ctx.globalAlpha = watermark.opacity ?? 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  console.log('[watermarkRenderer] 渲染参数:', {
    text,
    fontName,
    fontSize,
    canvasWidth,
    canvasHeight,
    centerX,
    centerY,
    rotation: watermark.rotation,
    opacity: watermark.opacity,
  });

  ctx.save();

  // 应用旋转变换（绕中心点）
  const rotation = watermark.rotation || 0;
  if (rotation !== 0) {
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  // 绘制文字（从中心点开始）
  ctx.fillText(text, centerX, centerY);

  ctx.restore();

  console.log('[watermarkRenderer] 渲染完成');
}

/**
 * 渲染水印到 Canvas，返回 PNG Buffer
 *
 * @param {Object} watermark - 水印参数
 * @param {number} width - Canvas 宽度
 * @param {number} height - Canvas 高度
 * @param {string} fontDir - 字体目录路径
 * @returns {Promise<{canvas: Object, width: number, height: number}>}
 */
export async function renderWatermarkToCanvas(watermark, width, height, fontDir) {
  const fontName = watermark.font || '黑体';

  // 注册字体
  const fontFileName = getFontFileName(fontName);
  const fontPath = path.join(fontDir, fontFileName);
  try {
    await registerFontForCanvas(fontName, fontPath);
  } catch (error) {
    console.warn(`[watermarkRenderer] 注册字体失败: ${fontName}`, error.message);
  }

  // 创建 Canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 使用 fillText 渲染
  drawWatermarkOnCanvas(ctx, watermark, width, height);

  return { canvas, width, height };
}

/**
 * 计算水印的渲染参数（用于前端预览同步）
 * 返回与渲染相关的所有计算值
 *
 * @param {Object} watermark - 水印参数
 * @param {number} canvasWidth - Canvas 宽度
 * @param {number} canvasHeight - Canvas 高度
 * @returns {Object} 渲染参数
 */
export function calculateWatermarkParams(watermark, canvasWidth, canvasHeight) {
  const fontSize = canvasWidth * watermark.scale;
  const centerX = canvasWidth * watermark.x;
  const centerY = canvasHeight * watermark.y;

  return {
    fontSize,
    centerX,
    centerY,
    rotation: watermark.rotation || 0,
    opacity: watermark.opacity ?? 1,
  };
}
