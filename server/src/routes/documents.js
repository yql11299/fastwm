/**
 * 证件路由
 * 处理证件文件列表、常用证件等功能的 API
 */

import express from 'express';
import path from 'path';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { successResponse, ApiError } from '../utils/response.js';
import { readDir, getFileInfo, ensureDir, readJson, writeJson } from '../utils/fileManager.js';
import fs from 'fs/promises';

const router = express.Router();

// 文档根目录
const DOCS_ROOT = config.dirs.documents;

/**
 * 生成文件 ID
 * @param {string} filePath - 文件路径
 * @returns {string}
 */
function generateFileId(filePath) {
  // 使用相对路径的哈希作为 ID
  const relativePath = path.relative(DOCS_ROOT, filePath);
  const hash = relativePath.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return `doc_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * 扫描目录获取文件列表
 * @param {string} dirPath - 目录路径
 * @param {string[]} extensions - 过滤的扩展名
 * @returns {Promise<Array>}
 */
async function scanDirectory(dirPath, extensions = config.supportedFileTypes.documents) {
  const items = await readDir(dirPath);
  const result = [];

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      // 递归扫描子目录（懒加载时只返回目录结构，不递归）
      const children = await scanDirectory(itemPath, extensions);
      result.push({
        id: generateFileId(itemPath),
        name: item.name,
        path: path.relative(DOCS_ROOT, itemPath),
        type: 'directory',
        size: 0,
        isDirectory: true,
        children: children.length > 0 ? children : null,
      });
    } else {
      // 检查文件扩展名
      const ext = path.extname(item.name).toLowerCase().slice(1);
      if (extensions.includes(ext)) {
        const fileInfo = await getFileInfo(itemPath);
        result.push({
          id: generateFileId(itemPath),
          name: item.name,
          path: path.relative(DOCS_ROOT, itemPath),
          type: ext,
          size: fileInfo.size,
          isDirectory: false,
          children: null,
        });
      }
    }
  }

  // 按名称排序：目录在前，然后按名称排序
  result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  return result;
}

/**
 * 获取用户常用证件列表文件路径
 * @param {string} userId - 用户ID
 * @returns {string}
 */
function getFavoritesFilePath(userId) {
  return path.join(config.dirs.users, userId, 'favorites.json');
}

/**
 * 获取用户常用证件列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>}
 */
async function getFavorites(userId) {
  const favoritesFile = getFavoritesFilePath(userId);
  const favorites = await readJson(favoritesFile);
  return favorites || [];
}

/**
 * 保存用户常用证件列表
 * @param {string} userId - 用户ID
 * @param {Array} favorites - 常用证件列表
 */
async function saveFavorites(userId, favorites) {
  const favoritesFile = getFavoritesFilePath(userId);
  await writeJson(favoritesFile, favorites);
}

/**
 * GET /api/documents
 * 获取服务器证件文件列表（懒加载目录）
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { path: relativePath, extensions } = req.query;

    // 确保文档目录存在
    await ensureDir(DOCS_ROOT);

    // 解析请求的路径
    let targetPath = DOCS_ROOT;
    if (relativePath) {
      // 清理路径：移除开头的 /，然后使用 path.join 组合
      // 防止路径遍历攻击，同时兼容 Windows 和 Unix 风格路径
      const cleanPath = relativePath.replace(/^\/+/, ''); // 移除开头的斜杠
      const requestedPath = path.normalize(path.join(DOCS_ROOT, cleanPath));
      if (!requestedPath.startsWith(path.normalize(DOCS_ROOT) + path.sep) && requestedPath !== path.normalize(DOCS_ROOT)) {
        throw new ApiError(400, 'VALIDATION_ERROR', '无效的路径');
      }
      targetPath = requestedPath;
    }

    // 解析扩展名过滤
    let extFilter = config.supportedFileTypes.documents;
    if (extensions) {
      extFilter = extensions.split(',').map((e) => e.trim().toLowerCase());
    }

    // 获取父目录路径
    // parentPath 为空字符串表示父目录是根目录，为 null 表示无父目录
    let parentPath = null;
    if (targetPath !== DOCS_ROOT) {
      const parentDir = path.dirname(targetPath);
      if (parentDir === DOCS_ROOT) {
        // 父目录是根目录，parentPath 为空字符串
        parentPath = '';
      } else {
        // 父目录是子目录，返回相对路径
        parentPath = path.relative(DOCS_ROOT, parentDir);
      }
    }

    // 扫描目录
    const items = await scanDirectory(targetPath, extFilter);

    res.json(
      successResponse({
        currentPath: path.relative(DOCS_ROOT, targetPath) || '/',
        parentPath,
        items,
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
    console.error('Get documents error:', error);
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
 * GET /api/documents/favorites
 * 获取用户常用证件列表
 */
router.get('/favorites', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await getFavorites(userId);

    // 填充文件详情
    const populatedFavorites = [];
    for (const fav of favorites) {
      const filePath = path.join(DOCS_ROOT, fav.filePath);
      // 防止路径遍历攻击：验证路径在 DOCS_ROOT 内
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(path.resolve(DOCS_ROOT))) {
        continue; // 跳过无效路径
      }
      try {
        const fileInfo = await getFileInfo(filePath);
        populatedFavorites.push({
          id: fav.fileId,
          name: fav.fileName,
          path: fav.filePath,
          type: fav.fileType,
          size: fileInfo.size,
          isDirectory: false,
        });
      } catch {
        // 文件不存在，跳过
      }
    }

    res.json(successResponse(populatedFavorites));
  } catch (error) {
    console.error('Get favorites error:', error);
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
 * POST /api/documents/favorites
 * 添加证件到常用列表
 */
router.post('/favorites', authMiddleware, async (req, res) => {
  try {
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'fileIds 必须是非空数组');
    }

    // 获取现有常用列表
    const favorites = await getFavorites(userId);
    const existingIds = new Set(favorites.map((f) => f.fileId));

    // 添加新的常用证件
    const added = [];
    for (const fileId of fileIds) {
      if (!existingIds.has(fileId)) {
        // 需要从文件信息中获取详情
        // 由于 fileIds 可能只包含 ID，需要查找对应文件
        // 简化处理：前端应提供完整信息
        added.push(fileId);
      }
    }

    // 如果请求中包含完整信息，使用请求中的信息
    if (req.body.files) {
      for (const file of req.body.files) {
        if (fileIds.includes(file.fileId) && !existingIds.has(file.fileId)) {
          favorites.push({
            fileId: file.fileId,
            fileName: file.fileName,
            filePath: file.filePath,
            fileType: file.fileType,
          });
        }
      }
      await saveFavorites(userId, favorites);
    } else {
      // 只有 ID，没有完整信息，先存储 ID 占位
      for (const fileId of added) {
        favorites.push({
          fileId,
          fileName: fileId,
          filePath: fileId,
          fileType: 'unknown',
        });
      }
      await saveFavorites(userId, favorites);
    }

    res.json(
      successResponse({
        added: fileIds,
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
    console.error('Add favorites error:', error);
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
 * DELETE /api/documents/favorites
 * 从常用列表移除证件
 */
router.delete('/favorites', authMiddleware, async (req, res) => {
  try {
    const { fileIds } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'fileIds 必须是非空数组');
    }

    const favorites = await getFavorites(userId);
    const filtered = favorites.filter((f) => !fileIds.includes(f.fileId));
    await saveFavorites(userId, filtered);

    res.json(
      successResponse({
        removed: fileIds,
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
    console.error('Remove favorites error:', error);
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
 * 获取文件绝对路径
 * @param {string} relativePath - 相对路径
 * @returns {string}
 */
function getAbsolutePath(relativePath) {
  const requestedPath = path.resolve(DOCS_ROOT, relativePath);
  if (!requestedPath.startsWith(DOCS_ROOT)) {
    throw new ApiError(400, 'DOC_FILE_NOT_FOUND', '文件不存在');
  }
  return requestedPath;
}

/**
 * 根据文件 ID 查找文件路径
 * @param {string} fileId - 文件 ID
 * @returns {Promise<string|null>}
 */
async function findFileById(fileId) {
  // 直接在文档目录中搜索匹配的文件
  const files = await scanDirectory(DOCS_ROOT);

  for (const file of files) {
    if (file.id === fileId) {
      return path.join(DOCS_ROOT, file.path);
    }
    // 如果是目录，递归搜索（这里简化处理）
  }

  // 遍历查找
  async function searchFiles(items) {
    for (const item of items) {
      if (item.id === fileId && !item.isDirectory) {
        return path.join(DOCS_ROOT, item.path);
      }
      if (item.children) {
        const found = await searchFiles(item.children);
        if (found) return found;
      }
    }
    return null;
  }

  return searchFiles(files);
}

/**
 * 生成缩略图（简化版本，返回原始图片）
 * 对于生产环境，应该使用 sharp 或类似库生成真正的缩略图
 * 这里为了简化，直接返回原始图片，前端可以自行缩放显示
 * @param {string} filePath - 文件路径
 * @returns {Promise<Buffer>}
 */
async function generateThumbnail(filePath) {
  return fs.readFile(filePath);
}

/**
 * GET /api/documents/thumbnail/:id
 * 获取证件缩略图
 */
router.get('/thumbnail/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 查找文件
    const filePath = await findFileById(id);

    if (!filePath) {
      throw new ApiError(404, 'DOC_FILE_NOT_FOUND', '文件不存在');
    }

    // 验证路径安全
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(DOCS_ROOT))) {
      throw new ApiError(400, 'DOC_FILE_NOT_FOUND', '文件不存在');
    }

    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch {
      throw new ApiError(404, 'DOC_FILE_NOT_FOUND', '文件不存在');
    }

    // 获取文件扩展名
    const ext = path.extname(filePath).toLowerCase();

    // 只支持图片格式的缩略图
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      throw new ApiError(400, 'UNSUPPORTED_FORMAT', '缩略图只支持 JPG/PNG 格式');
    }

    // 读取文件
    const buffer = await generateThumbnail(filePath);

    // 设置响应头
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存 1 天

    res.send(buffer);
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
    console.error('Get thumbnail error:', error);
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
 * GET /api/documents/:id/content
 * 获取文件内容（返回 base64 编码）
 */
router.get('/:id/content', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 查找文件
    const filePath = await findFileById(id);

    if (!filePath) {
      throw new ApiError(404, 'DOC_FILE_NOT_FOUND', '文件不存在');
    }

    // 验证路径安全
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(DOCS_ROOT))) {
      throw new ApiError(400, 'DOC_FILE_NOT_FOUND', '文件不存在');
    }

    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch {
      throw new ApiError(404, 'DOC_FILE_NOT_FOUND', '文件不存在');
    }

    // 获取文件扩展名并设置 MIME 类型
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.pdf': 'application/pdf',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // 读取文件并转换为 base64
    const buffer = await fs.readFile(filePath);
    const base64Content = buffer.toString('base64');

    // 返回 JSON 响应
    res.json(
      successResponse({
        content: base64Content,
        mimeType,
        fileName: path.basename(filePath),
        size: buffer.length,
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
    console.error('Get document content error:', error);
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
