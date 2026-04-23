/**
 * 字体管理 API 路由
 * 处理字体列表获取、字体文件下载等功能
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';
import { successResponse, ApiError } from '../utils/response.js';
import { readFile, exists } from '../utils/fileManager.js';
import textToPath from '../services/textToPath.js';

const router = express.Router();

// 字体目录
const FONTS_DIR = config.dirs.fonts;

// 字体名称映射
const FONT_MAPPINGS = {
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

/**
 * 获取字体文件路径
 * @param {string} fontName - 字体名称
 * @returns {string|null}
 */
function getFontFilePath(fontName) {
  // 防止路径遍历攻击：验证字体名称只包含安全字符
  // 只允许字母、数字、中文、空格、连字符、下划线和点号（用于扩展名）
  if (!/^[a-zA-Z0-9\u4e00-\u9fa5\s\-_\.]+$/.test(fontName)) {
    return null;
  }

  // 优先从映射表查找
  const mappedName = FONT_MAPPINGS[fontName];
  if (mappedName) {
    return path.join(FONTS_DIR, mappedName);
  }

  // 尝试直接匹配
  const directPath = path.join(FONTS_DIR, fontName);
  if (fontName.endsWith('.ttf') || fontName.endsWith('.otf')) {
    return directPath;
  }

  // 尝试添加扩展名
  const ttfPath = path.join(FONTS_DIR, `${fontName}.ttf`);
  const otfPath = path.join(FONTS_DIR, `${fontName}.otf`);

  return ttfPath; // 默认返回 ttf 路径，实际检查会在后面进行
}

/**
 * 获取字体 MIME 类型
 * @param {string} filePath - 文件路径
 * @returns {string}
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttc': 'font/collection',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * GET /api/fonts
 * 获取字体列表
 */
router.get('/', async (req, res) => {
  try {
    const fonts = await textToPath.getAvailableFonts();

    // 添加预览文字
    const previewText = '微软雅黑 Preview 文字';
    const fontList = fonts.map((font) => ({
      name: font.name,
      family: font.family || font.name,
      file: font.file,
      supported: font.supported,
      preview: font.supported ? previewText : null,
      error: font.error || null,
    }));

    // 如果没有找到字体，返回默认字体信息
    if (fontList.length === 0) {
      // 检查 fonts 目录中是否有字体文件
      try {
        const files = await fs.readdir(FONTS_DIR);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (ext === '.ttf' || ext === '.otf') {
            fontList.push({
              name: path.basename(file, ext),
              family: path.basename(file, ext),
              file: file,
              supported: true,
              preview: previewText,
            });
          }
        }
      } catch {
        // 目录不存在或无法读取
      }
    }

    res.json(successResponse(fontList));
  } catch (error) {
    console.error('Get fonts error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
});

/**
 * GET /api/fonts/:name
 * 获取字体文件
 */
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // 获取字体文件路径
    let fontPath;

    if (name.endsWith('.ttf') || name.endsWith('.otf')) {
      fontPath = path.join(FONTS_DIR, name);
    } else {
      // 尝试不同的扩展名
      const ttfPath = path.join(FONTS_DIR, `${name}.ttf`);
      const otfPath = path.join(FONTS_DIR, `${name}.otf`);

      if (await exists(ttfPath)) {
        fontPath = ttfPath;
      } else if (await exists(otfPath)) {
        fontPath = otfPath;
      } else {
        // 尝试字体名称映射
        const mappedFile = FONT_MAPPINGS[name];
        if (mappedFile) {
          fontPath = path.join(FONTS_DIR, mappedFile);
        } else {
          throw new ApiError(404, 'FONT_NOT_FOUND', `找不到字体: ${name}`);
        }
      }
    }

    // 检查文件是否存在
    if (!(await exists(fontPath))) {
      throw new ApiError(404, 'FONT_NOT_FOUND', `找不到字体: ${name}`);
    }

    // 检查是否为 TTC 格式（不支持）
    const ext = path.extname(fontPath).toLowerCase();
    if (ext === '.ttc') {
      throw new ApiError(400, 'UNSUPPORTED_FONT_FORMAT', '不支持 TTC 字体格式，请使用 TTF 或 OTF 格式');
    }

    // 读取字体文件
    const fontBuffer = await readFile(fontPath);

    // 设置响应头
    const mimeType = getMimeType(fontPath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fontBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存 1 天

    res.send(fontBuffer);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    console.error('Get font error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
});

/**
 * GET /api/fonts/:name/preview
 * 获取字体预览信息（Base64 编码的字体数据）
 */
router.get('/:name/preview', async (req, res) => {
  try {
    const { name } = req.params;

    // 获取字体文件路径
    let fontPath;
    if (name.endsWith('.ttf') || name.endsWith('.otf')) {
      fontPath = path.join(FONTS_DIR, name);
    } else {
      const ttfPath = path.join(FONTS_DIR, `${name}.ttf`);
      const otfPath = path.join(FONTS_DIR, `${name}.otf`);

      if (await exists(ttfPath)) {
        fontPath = ttfPath;
      } else if (await exists(otfPath)) {
        fontPath = otfPath;
      } else {
        throw new ApiError(404, 'FONT_NOT_FOUND', `找不到字体: ${name}`);
      }
    }

    if (!(await exists(fontPath))) {
      throw new ApiError(404, 'FONT_NOT_FOUND', `找不到字体: ${name}`);
    }

    // 检查是否为 TTC 格式
    const ext = path.extname(fontPath).toLowerCase();
    if (ext === '.ttc') {
      throw new ApiError(400, 'UNSUPPORTED_FONT_FORMAT', '不支持 TTC 字体格式');
    }

    // 读取字体文件并转换为 Base64
    const fontBuffer = await readFile(fontPath);
    const base64 = fontBuffer.toString('base64');
    const mimeType = getMimeType(fontPath);

    res.json(
      successResponse({
        name,
        data: `data:${mimeType};base64,${base64}`,
        format: mimeType,
      })
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    console.error('Get font preview error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
});

/**
 * POST /api/fonts/text-to-path
 * 将文字转换为 SVG path data（用于前端水印预览）
 */
router.post('/text-to-path', async (req, res) => {
  try {
    const { text, fontName, fontSize = 1000 } = req.body;

    console.log('[text-to-path] 收到请求:', { text, fontName, fontSize });

    if (!text || typeof text !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', '文字内容无效');
    }

    if (!fontName || typeof fontName !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', '字体名称无效');
    }

    const result = await textToPath.getTextPaths(text, fontName, fontSize);

    console.log('[text-to-path] 返回结果:', {
      pathsCount: result.paths.length,
      totalWidth: result.totalWidth,
      totalHeight: result.totalHeight,
      baseline: result.baseline,
    });

    res.json(successResponse(result));
  } catch (error) {
    console.error('[text-to-path] 错误:', error);
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    console.error('Text to path error:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
});


export default router;
