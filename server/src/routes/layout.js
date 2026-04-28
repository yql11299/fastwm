/**
 * 布局管理路由
 * 处理用户布局的获取、保存、导出和导入
 */

import express from 'express';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { readJson, writeJson, ensureDir, exists } from '../utils/fileManager.js';
import { successResponse, ApiError } from '../utils/response.js';
import path from 'path';

const router = express.Router();

/**
 * 获取用户布局目录路径
 * @param {string} userId - 用户ID
 * @returns {string}
 */
function getUserLayoutPath(userId) {
  return path.join(config.dirs.users, userId, 'layout.json');
}

/**
 * 获取导出目录路径
 * @param {string} userId - 用户ID
 * @returns {string}
 */
function getExportDir(userId) {
  return path.join(config.dirs.users, userId, 'exports');
}

/**
 * GET /api/layout
 * 获取用户布局
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const layoutPath = getUserLayoutPath(userId);

    // 检查布局文件是否存在
    const layoutData = await readJson(layoutPath);

    if (!layoutData) {
      // 如果不存在，返回空布局
      return res.json(successResponse({
        userId,
        updatedAt: null,
        items: [],
      }));
    }

    res.json(successResponse(layoutData));
  } catch (error) {
    console.error('Get layout error:', error);
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
 * PUT /api/layout
 * 保存用户布局
 */
router.put('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body;

    // 验证 items 参数
    if (!Array.isArray(items)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '布局项目必须是数组');
    }

    // 验证每个布局项的格式
    for (const item of items) {
      if (typeof item.fileId !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', '布局项必须包含有效的 fileId');
      }
      if (typeof item.row !== 'number' || item.row < 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', '布局项必须包含有效的 row（大于等于0的数字）');
      }
      if (typeof item.order !== 'number' || item.order < 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', '布局项必须包含有效的 order（大于等于0的数字）');
      }
      // 可选字段：fileName, filePath, fileType
      // 这些字段在前端重命名时会被更新
    }

    const layoutData = {
      userId,
      updatedAt: new Date().toISOString(),
      items,
    };

    const layoutPath = getUserLayoutPath(userId);
    await writeJson(layoutPath, layoutData);

    res.json(successResponse(layoutData));
  } catch (error) {
    console.error('Save layout error:', error);
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
 * POST /api/layout/export
 * 导出布局为文件下载
 */
router.post('/export', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileName } = req.body;

    const layoutPath = getUserLayoutPath(userId);
    const layoutData = await readJson(layoutPath);

    if (!layoutData) {
      throw new ApiError(404, 'LAYOUT_NOT_FOUND', '布局不存在');
    }

    // 生成导出文件名
    const exportFileName = fileName && typeof fileName === 'string'
      ? fileName
      : `layout_${Date.now()}.json`;

    // 直接返回 JSON 文件下载
    const jsonContent = JSON.stringify(layoutData, null, 2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);
    res.send(jsonContent);
  } catch (error) {
    console.error('Export layout error:', error);
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
 * POST /api/layout/import
 * 导入本地布局
 */
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { layout } = req.body;

    // 验证布局数据
    if (!layout || typeof layout !== 'object') {
      throw new ApiError(400, 'VALIDATION_ERROR', '布局数据无效');
    }

    if (!Array.isArray(layout.items)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '布局项目必须是数组');
    }

    // 验证每个布局项的格式
    for (const item of layout.items) {
      if (typeof item.fileId !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', '布局项必须包含有效的 fileId');
      }
      if (typeof item.row !== 'number' || item.row < 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', '布局项必须包含有效的 row');
      }
      if (typeof item.order !== 'number' || item.order < 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', '布局项必须包含有效的 order');
      }
    }

    // 保存导入的布局
    const layoutData = {
      userId,
      updatedAt: new Date().toISOString(),
      items: layout.items,
    };

    const layoutPath = getUserLayoutPath(userId);
    await writeJson(layoutPath, layoutData);

    res.json(successResponse(layoutData));
  } catch (error) {
    console.error('Import layout error:', error);
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
