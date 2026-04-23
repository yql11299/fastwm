/**
 * 文字转 SVG Path 服务
 * 使用 opentype.js 加载 TTF 字体，将文字转为 SVG path data
 */

import opentype from 'opentype.js';
import path from 'path';
import { config } from '../config/index.js';
import { readFile } from '../utils/fileManager.js';
import { ApiError } from '../utils/response.js';

// 字体缓存
const fontCache = new Map();

/**
 * 加载字体文件
 * @param {string} fontName - 字体名称（如 '黑体', 'simhei'）
 * @returns {Promise<opentype.Font>}
 */
async function loadFont(fontName) {
  // 检查缓存
  if (fontCache.has(fontName)) {
    return fontCache.get(fontName);
  }

  // 查找字体文件
  const fontFile = findFontFile(fontName);
  if (!fontFile) {
    throw new ApiError(400, 'FONT_NOT_FOUND', `找不到字体: ${fontName}`);
  }

  // 读取字体文件
  const fontPath = path.join(config.dirs.fonts, fontFile);
  const fontBuffer = await readFile(fontPath);

  // 解析字体
  let font;
  try {
    font = opentype.parse(fontBuffer.buffer);
  } catch (error) {
    throw new ApiError(400, 'FONT_PARSE_ERROR', `字体解析失败: ${fontName}`, {
      originalError: error.message,
    });
  }

  // 缓存字体
  fontCache.set(fontName, font);

  return font;
}

/**
 * 查找字体文件
 * @param {string} fontName - 字体名称
 * @returns {string|null}
 */
function findFontFile(fontName) {
  const fontsDir = config.dirs.fonts;

  // 字体名称映射
  const fontMappings = {
    黑体: 'simhei.ttf',
    simhei: 'simhei.ttf',
    simkai: 'simkai.ttf',
    楷体: 'simkai.ttf',
    宋体: 'simsun.ttf',
    simsun: 'simsun.ttf',
    微软雅黑: 'msyh.ttf',
    msyh: 'msyh.ttf',
    MicrosoftYaHei: 'msyh.ttf',
  };

  const fileName = fontMappings[fontName.toLowerCase()];
  if (fileName) {
    return fileName;
  }

  // 尝试直接匹配文件名
  const fs = require('fs/promises');
  // 同步检查文件是否存在
  try {
    const files = require('fs').readdirSync(fontsDir);
    const matching = files.find(
      (f) => f.toLowerCase() === `${fontName.toLowerCase()}.ttf` ||
             f.toLowerCase() === `${fontName.toLowerCase()}.otf`
    );
    if (matching) {
      return matching;
    }
  } catch {
    // 目录不存在
  }

  return null;
}

/**
 * 将字形转换为 SVG path data
 * @param {opentype.Glyph} glyph - 字形
 * @param {number} fontSize - 字体大小
 * @returns {string} SVG path data
 */
function glyphToPathData(glyph, fontSize) {
  if (!glyph.path) {
    return '';
  }

  const pathData = glyph.path.toSVG(2);
  return pathData;
}

/**
 * 获取文字的路径信息
 * @param {string} text - 文字内容
 * @param {string} fontName - 字体名称
 * @param {number} fontSize - 字体大小（可选，默认1000）
 * @returns {Promise<Object>}
 */
async function getTextPaths(text, fontName, fontSize = 1000) {
  console.log('[textToPath] getTextPaths 调用:', { text, fontName, fontSize });

  if (!text || text.length === 0) {
    return {
      paths: [],
      totalWidth: 0,
      totalHeight: 0,
      baseline: 0,
    };
  }

  const font = await loadFont(fontName);
  console.log('[textToPath] 字体加载成功:', fontName);

  // 获取字形的统一高度（em square）
  const unitsPerEm = font.unitsPerEm;

  // 计算缩放比例
  const scale = fontSize / unitsPerEm;

  const paths = [];
  let totalWidth = 0;
  let maxHeight = 0;
  let minY = 0;
  let maxY = 0;

  // 遍历每个字符
  for (const char of text) {
    // 获取字符的字形
    const glyph = font.charToGlyph(char);
    if (!glyph) {
      console.log('[textToPath] 字符未找到字形:', char);
      continue;
    }

    // 获取字形路径
    const pathData = glyphToPathData(glyph, fontSize);

    // 计算字形宽度
    const advanceWidth = glyph.advanceWidth * scale;

    // 获取字形边界框（相对于 baseline）
    const bbox = glyph.getBoundingBox();
    const yMin = (bbox.y1 || 0) * scale;
    const yMax = (bbox.y2 || 0) * scale;
    const height = yMax - yMin;

    // 更新总体尺寸
    maxHeight = Math.max(maxHeight, height);
    minY = Math.min(minY, yMin);
    maxY = Math.max(maxY, yMax);

    paths.push({
      char,
      pathData,
      x: totalWidth,
      width: advanceWidth,
      height,
      yMin,
      yMax,
    });

    totalWidth += advanceWidth;
  }

  // 计算 baseline 偏移（用于垂直居中）
  const baseline = maxY;

  const result = {
    paths,
    totalWidth,
    totalHeight: maxHeight,
    baseline,
    scale,
    unitsPerEm,
  };

  console.log('[textToPath] 返回结果:', {
    pathsCount: paths.length,
    totalWidth,
    totalHeight: maxHeight,
    baseline,
  });

  return result;
}

/**
 * 将文字转换为相对坐标的 SVG path data
 * @param {string} text - 文字内容
 * @param {string} fontName - 字体名称
 * @param {number} targetWidth - 目标宽度（相对值）
 * @returns {Promise<Object>}
 */
async function getTextPathsRelative(text, fontName, targetWidth = 0.5) {
  const result = await getTextPaths(text, fontName, 1000);

  if (result.totalWidth === 0) {
    return {
      paths: [],
      width: 0,
      height: 0,
      scale: 0,
    };
  }

  // 计算缩放比例，使宽度达到目标相对值
  // 假设背景宽度为 1，则 targetWidth = 0.5 表示宽度为背景的 50%
  const scale = targetWidth / result.totalWidth;

  // 转换路径数据为相对坐标
  const scaledPaths = result.paths.map((p) => ({
    char: p.char,
    pathData: scalePathData(p.pathData, scale, scale),
    x: p.x * scale,
    width: p.width * scale,
    height: p.height * scale,
    yMin: p.yMin * scale,
    yMax: p.yMax * scale,
  }));

  return {
    paths: scaledPaths,
    width: result.totalWidth * scale,
    height: result.totalHeight * scale,
    scale,
    baseline: result.baseline * scale,
  };
}

/**
 * 缩放 path data
 * @param {string} pathData - SVG path data
 * @param {number} scaleX - X 轴缩放
 * @param {number} scaleY - Y 轴缩放
 * @param {number} offsetX - X 轴偏移
 * @param {number} offsetY - Y 轴偏移
 * @returns {string}
 */
function scalePathData(pathData, scaleX, scaleY, offsetX = 0, offsetY = 0) {
  // 解析 path data 并缩放
  // SVG path 命令：M (moveto), L (lineto), C (curveto), Q (quadratic), Z (close)
  // 格式：命令 + 数字序列

  return pathData.replace(
    /([MLCQZmlcqz])([^MLCQZmlcqz]*)/gi,
    (match, cmd, coords) => {
      if (!coords.trim()) return cmd;

      // 解析坐标数字
      const numbers = coords.match(/-?\d+\.?\d*/g) || [];
      const scaledNumbers = numbers.map((num, i) => {
        // 判断是 X 坐标还是 Y 坐标（根据在数字序列中的位置）
        // 在 M, L, C, Q 等命令中，坐标是成对的 (x, y)
        const cmdUpper = cmd.toUpperCase();
        const coordIndex = Math.floor(i / (cmdUpper === 'C' ? 6 : 2));
        const isX = i % 2 === 0;

        const scale = isX ? scaleX : scaleY;
        const offset = isX ? offsetX : offsetY;

        return parseFloat(num) * scale + offset;
      });

      // 重新组装坐标字符串
      let newCoords = '';
      for (let i = 0; i < scaledNumbers.length; i += 2) {
        if (i > 0) newCoords += ' ';
        newCoords += `${scaledNumbers[i].toFixed(2)},${scaledNumbers[i + 1].toFixed(2)}`;
      }

      return cmd + newCoords;
    }
  );
}

/**
 * 生成完整的 SVG 字符串
 * @param {string} text - 文字内容
 * @param {string} fontName - 字体名称
 * @param {Object} options - 选项
 * @returns {Promise<string>}
 */
async function generateSvgPath(text, fontName, options = {}) {
  const {
    x = 0,
    y = 0,
    scale = 0.5,
    rotation = 0,
    opacity = 1,
    color = '#808080',
  } = options;

  const result = await getTextPaths(text, fontName, 1000);

  if (result.paths.length === 0) {
    return null;
  }

  // 缩放到目标宽度
  const targetWidth = scale;
  const actualScale = targetWidth / result.totalWidth;
  const scaledPaths = result.paths.map((p) => ({
    ...p,
    pathData: scalePathData(p.pathData, actualScale, actualScale),
    x: p.x * actualScale,
    width: p.width * actualScale,
    height: p.height * actualScale,
  }));

  // 计算 SVG 尺寸
  const svgWidth = result.totalWidth * actualScale;
  const svgHeight = result.totalHeight * actualScale;

  // 构建 SVG
  const pathsSvg = scaledPaths
    .map(
      (p) =>
        `<path d="${p.pathData}" transform="translate(${p.x}, ${svgHeight - result.baseline * actualScale + p.yMin * actualScale})" fill="${color}" opacity="${opacity}"/>`
    )
    .join('\n');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <g transform="translate(${x}, ${y})${rotation !== 0 ? ` rotate(${rotation}, ${svgWidth / 2}, ${svgHeight / 2})` : ''}">
    ${pathsSvg}
  </g>
</svg>
  `.trim();

  return {
    svg,
    width: svgWidth,
    height: svgHeight,
    paths: scaledPaths,
  };
}

/**
 * 清除字体缓存
 */
function clearFontCache() {
  fontCache.clear();
}

/**
 * 获取合并的整体路径数据
 * 将所有字符的路径合并成一个完整的 SVG path
 * @param {string} text - 文字内容
 * @param {string} fontName - 字体名称
 * @param {number} fontSize - 字体大小（可选，默认1000）
 * @returns {Promise<Object>}
 */
async function getMergedPath(text, fontName, fontSize = 1000) {
  console.log('[textToPath] getMergedPath 调用:', { text, fontName, fontSize });

  const result = await getTextPaths(text, fontName, fontSize);

  if (result.paths.length === 0) {
    return {
      mergedPathData: '',
      totalWidth: 0,
      totalHeight: 0,
      baseline: 0,
    };
  }

  // 合并所有字符的路径
  // 每个字符的路径需要根据其在文本中的位置进行偏移
  const mergedPaths = [];

  for (const charPath of result.paths) {
    if (!charPath.pathData || charPath.pathData.length < 3) {
      continue;
    }

    // 将字符路径的 X 坐标偏移 charPath.x
    // Y 坐标保持不变（所有字符共享同一个 baseline）
    const offsetPathData = scalePathData(charPath.pathData, 1, 1, charPath.x, 0);
    mergedPaths.push(offsetPathData);
  }

  // 合并所有路径
  const mergedPathData = mergedPaths.join(' ');

  console.log('[textToPath] getMergedPath 返回:', {
    mergedPathLength: mergedPathData.length,
    totalWidth: result.totalWidth,
    totalHeight: result.totalHeight,
    baseline: result.baseline,
  });

  return {
    mergedPathData,
    totalWidth: result.totalWidth,
    totalHeight: result.totalHeight,
    baseline: result.baseline,
  };
}

/**
 * 获取支持的字体列表
 * @returns {Array}
 */
async function getAvailableFonts() {
  const fs = await import('fs/promises');
  const fonts = [];

  try {
    const files = await fs.readdir(config.dirs.fonts);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.ttf' || ext === '.otf') {
        // 过滤掉 TTC 格式
        const fontBuffer = await readFile(path.join(config.dirs.fonts, file));

        try {
          const font = opentype.parse(fontBuffer.buffer);
          fonts.push({
            name: path.basename(file, ext),
            file,
            family: font.names.fontFamily?.en || path.basename(file, ext),
            supported: true,
          });
        } catch {
          // 解析失败，跳过
          fonts.push({
            name: path.basename(file, ext),
            file,
            supported: false,
            error: '无法解析字体文件',
          });
        }
      }
    }
  } catch {
    // 字体目录不存在
  }

  return fonts;
}

export default {
  loadFont,
  getTextPaths,
  getTextPathsRelative,
  generateSvgPath,
  clearFontCache,
  getAvailableFonts,
  getMergedPath,
};
