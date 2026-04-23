/**
 * PDF 渲染工具 - 使用 pdf.js 将 PDF 渲染到 Canvas
 */
import * as pdfjsLib from 'pdfjs-dist';

// 使用本地 worker 文件（pdfjs-dist 5.x 版本）
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

/**
 * 将 PDF buffer 渲染到 Canvas
 * @param {string|Uint8Array} buffer - PDF 数据（base64 data URL 或 Uint8Array）
 * @param {number} pageNum - 页码（从 1 开始）
 * @param {number} targetWidth - 目标宽度（设为 0 则使用 scale 参数）
 * @param {number} scale - 缩放比例（当 targetWidth > 0 时被忽略）
 * @returns {Promise<{canvas: HTMLCanvasElement, width: number, height: number, originalWidth: number, originalHeight: number}>}
 */
export async function renderPdfBufferToCanvas(buffer, pageNum = 1, targetWidth = 0, scale = 1.0) {
  let data;

  if (typeof buffer === 'string') {
    // base64 data URL 格式：data:application/pdf;base64,xxxxx
    if (buffer.includes(',')) {
      const base64 = buffer.split(',')[1];
      const binary = atob(base64);
      data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        data[i] = binary.charCodeAt(i);
      }
    } else {
      // 普通 base64 字符串
      const binary = atob(buffer);
      data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        data[i] = binary.charCodeAt(i);
      }
    }
  } else {
    data = buffer;
  }

  // 加载 PDF 文档
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  // 获取指定页
  const page = await pdfDoc.getPage(pageNum);

  // 获取原始尺寸（scale=1）
  const originalViewport = page.getViewport({ scale: 1 });
  const originalWidth = originalViewport.width;
  const originalHeight = originalViewport.height;

  // 计算缩放因子
  let actualScale;
  if (targetWidth > 0) {
    // 按目标宽度自适应
    actualScale = targetWidth / originalWidth;
  } else {
    actualScale = scale;
  }

  // 计算缩放后的尺寸
  const viewport = page.getViewport({ scale: actualScale });

  // 创建 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');

  // 渲染 PDF 到 Canvas
  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  return {
    canvas,
    width: viewport.width,
    height: viewport.height,
    originalWidth,
    originalHeight,
  };
}