/**
 * 背景文件 API 路由
 * 处理背景文件上传、存储和获取
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { successResponse, ApiError } from '../utils/response.js';
import { exists, ensureDir, getFileInfo } from '../utils/fileManager.js';

const router = express.Router();

// 背景文件根目录
const BACKGROUNDS_ROOT = config.dirs.backgrounds;

// 确保背景目录存在
let initDone = false;
async function ensureBackgroundsDir() {
  if (!initDone) {
    await ensureDir(BACKGROUNDS_ROOT);
    initDone = true;
  }
}

/**
 * 生成背景文件唯一 ID
 * @param {string} fileName - 原始文件名
 * @returns {string}
 */
function generateBackgroundId(fileName) {
  const timestamp = Date.now();
  const ext = path.extname(fileName).toLowerCase();
  const nameWithoutExt = path.basename(fileName, ext);
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  return `bg_${timestamp}_${safeName}${ext}`;
}

/**
 * 验证文件类型
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
async function isValidBackgroundFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const validExts = ['.jpg', '.jpeg', '.png', '.pdf'];
  return validExts.includes(ext);
}

/**
 * 获取图片尺寸
 * @param {string} filePath - 图片文件路径
 * @returns {Promise<{width: number, height: number}>}
 */
async function getImageDimensions(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
    // 读取图片获取尺寸
    const buffer = await fs.readFile(filePath);

    if (ext === '.png') {
      // PNG: 读取 IHDR chunk
      if (buffer.length >= 24 && buffer.toString('hex', 0, 8) === '89504e470d0a1a0a') {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // JPEG: 查找 SOF0 marker
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        // SOF0, SOF1, SOF2
        if (marker >= 0xc0 && marker <= 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
  }

  // 默认尺寸（PDF 或无法确定时）
  return { width: 0, height: 0 };
}

/**
 * POST /api/background/upload
 * 上传背景文件
 */
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    await ensureBackgroundsDir();

    // 处理 multipart form data
    const { file } = req.body;

    if (!file) {
      throw new ApiError(400, 'VALIDATION_ERROR', '没有上传文件');
    }

    // file 是 base64 编码的字符串
    let fileBuffer;
    let fileName;
    let mimeType;

    if (typeof file === 'object' && file.data) {
      // { name: 'xxx.jpg', data: 'base64...', mimeType: 'image/jpeg' }
      fileBuffer = Buffer.from(file.data, 'base64');
      fileName = file.name || 'background.jpg';
      mimeType = file.mimeType || 'image/jpeg';
    } else if (typeof file === 'string') {
      // 直接是 base64 字符串，需要从 context 推断
      fileBuffer = Buffer.from(file, 'base64');
      fileName = 'background.jpg';
      mimeType = 'image/jpeg';
    } else {
      throw new ApiError(400, 'VALIDATION_ERROR', '无效的文件格式');
    }

    // 生成唯一 ID
    const backgroundId = generateBackgroundId(fileName);
    const ext = path.extname(backgroundId).toLowerCase();

    // 验证文件类型
    if (!(await isValidBackgroundFile(backgroundId))) {
      throw new ApiError(400, 'INVALID_FILE_TYPE', '不支持的背景文件格式，仅支持 JPG、PNG、PDF');
    }

    // 确定实际 mime 类型
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.pdf') mimeType = 'application/pdf';
    else mimeType = 'image/jpeg';

    // 保存文件
    const filePath = path.join(BACKGROUNDS_ROOT, backgroundId);
    await fs.writeFile(filePath, fileBuffer);

    // 获取尺寸
    let dimensions = { width: 0, height: 0 };
    if (mimeType.startsWith('image/')) {
      try {
        dimensions = await getImageDimensions(filePath);
      } catch (e) {
        console.warn('Failed to get image dimensions:', e.message);
      }
    }

    res.status(201).json(
      successResponse({
        id: backgroundId,
        name: path.basename(fileName),
        width: dimensions.width,
        height: dimensions.height,
        type: ext.replace('.', ''),
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
    console.error('Background upload error:', error);
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
 * GET /api/background/:id
 * 获取背景文件
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 安全检查：验证 ID 格式
    if (!id || !id.startsWith('bg_')) {
      throw new ApiError(400, 'INVALID_BACKGROUND_ID', '无效的背景文件 ID');
    }

    const filePath = path.join(BACKGROUNDS_ROOT, id);

    // 防止路径遍历
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(BACKGROUNDS_ROOT))) {
      throw new ApiError(400, 'INVALID_FILE_PATH', '无效的文件路径');
    }

    // 检查文件是否存在
    if (!(await exists(filePath))) {
      throw new ApiError(404, 'BACKGROUND_NOT_FOUND', '背景文件不存在');
    }

    // 获取文件信息
    const fileInfo = await getFileInfo(filePath);

    // 确定 mime 类型
    const ext = path.extname(id).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.pdf') mimeType = 'application/pdf';

    // 设置响应头
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileInfo.size);
    res.setHeader('Content-Disposition', `inline; filename="${id}"`);

    // 发送文件
    const fileStream = await fs.readFile(filePath);
    res.send(fileStream);
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
    console.error('Get background error:', error);
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
 * DELETE /api/background/:id
 * 删除背景文件
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 安全检查
    if (!id || !id.startsWith('bg_')) {
      throw new ApiError(400, 'INVALID_BACKGROUND_ID', '无效的背景文件 ID');
    }

    const filePath = path.join(BACKGROUNDS_ROOT, id);

    // 防止路径遍历
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(BACKGROUNDS_ROOT))) {
      throw new ApiError(400, 'INVALID_FILE_PATH', '无效的文件路径');
    }

    // 检查文件是否存在
    if (!(await exists(filePath))) {
      throw new ApiError(404, 'BACKGROUND_NOT_FOUND', '背景文件不存在');
    }

    // 删除文件
    await fs.unlink(filePath);

    res.json(successResponse({ deleted: id }));
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
    console.error('Delete background error:', error);
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
 * GET /api/background
 * 列出所有背景文件
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    await ensureBackgroundsDir();

    const files = await fs.readdir(BACKGROUNDS_ROOT);
    const backgrounds = [];

    for (const file of files) {
      const filePath = path.join(BACKGROUNDS_ROOT, file);
      const stat = await fs.stat(filePath);

      if (stat.isFile() && file.startsWith('bg_')) {
        const ext = path.extname(file).toLowerCase();
        backgrounds.push({
          id: file,
          name: path.basename(file, ext),
          type: ext.replace('.', ''),
          size: stat.size,
          createdAt: stat.birthtime,
        });
      }
    }

    res.json(successResponse(backgrounds));
  } catch (error) {
    console.error('List backgrounds error:', error);
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
