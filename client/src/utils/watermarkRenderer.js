/**
 * 水印渲染工具 - 在 Canvas 上绘制水印
 * 与后端 watermarkRenderer.js 使用相同的 scale 计算公式，保证渲染一致性
 */

/**
 * 在 Canvas 上绘制水印（使用 fillText 方式，与后端一致）
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {Object} watermark - 水印参数
 * @param {number} canvasWidth - Canvas 宽度
 * @param {number} canvasHeight - Canvas 高度
 */
export function drawWatermarkOnCanvas(ctx, watermark, canvasWidth, canvasHeight) {
  console.log('[drawWatermarkOnCanvas] 开始渲染:', {
    canvasWidth,
    canvasHeight,
    watermark,
  });

  // 清空 Canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!watermark.text) {
    console.warn('[drawWatermarkOnCanvas] 无水印文字');
    return;
  }

  // 计算字体大小：scale=1.0 表示字体宽度等于背景宽度
  const fontSize = canvasWidth * watermark.scale;

  // 水印中心点
  const centerX = canvasWidth * watermark.x;
  const centerY = canvasHeight * watermark.y;

  // 设置样式
  ctx.font = `${fontSize}px "${watermark.font || '黑体'}"`;
  ctx.fillStyle = watermark.color || '#000000';
  ctx.globalAlpha = watermark.opacity ?? 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 应用旋转变换（绕中心点）
  const rotation = watermark.rotation || 0;
  if (rotation !== 0) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
    ctx.fillText(watermark.text, centerX, centerY);
    ctx.restore();
  } else {
    ctx.fillText(watermark.text, centerX, centerY);
  }

  console.log('[drawWatermarkOnCanvas] 渲染完成:', {
    fontSize,
    centerX,
    centerY,
    rotation,
    text: watermark.text,
  });
}

/**
 * 获取文字路径数据（复用 API 调用逻辑）
 * @param {string} text - 文字内容
 * @param {string} fontName - 字体名称
 * @returns {Promise<Object>} pathData
 */
export async function fetchTextPaths(text, fontName) {
  console.log('[fetchTextPaths] 开始请求:', { text, fontName });

  const response = await fetch('/api/fonts/text-to-path', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      fontName,
      fontSize: 1000, // 固定使用 1000，与后端一致
    }),
  });

  if (!response.ok) {
    console.error('[fetchTextPaths] 请求失败:', response.statusText);
    throw new Error(`Failed to fetch text paths: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[fetchTextPaths] 收到响应:', {
    success: data.success,
    hasData: !!data.data,
    pathsCount: data.data?.paths?.length || 0,
    totalWidth: data.data?.totalWidth || 0,
  });

  return data;
}