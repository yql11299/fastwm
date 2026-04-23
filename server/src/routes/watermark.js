/**
 * 水印方案管理路由
 * 处理水印方案的 CRUD、导出和导入
 */

import express from 'express';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { readJson, writeJson, ensureDir, exists, readDir, remove } from '../utils/fileManager.js';
import { successResponse, ApiError } from '../utils/response.js';
import path from 'path';

const router = express.Router();

/**
 * 获取用户方案目录路径
 * @param {string} userId - 用户ID
 * @returns {string}
 */
function getUserSchemesDir(userId) {
  return path.join(config.dirs.users, userId, 'schemes');
}

/**
 * 获取指定方案的完整路径
 * @param {string} userId - 用户ID
 * @param {string} schemeId - 方案ID
 * @returns {string}
 */
function getSchemePath(userId, schemeId) {
  return path.join(getUserSchemesDir(userId), `${schemeId}.json`);
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
 * 生成唯一的方案ID
 * @returns {string}
 */
function generateSchemeId() {
  return `scheme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * GET /api/watermark/schemes
 * 获取方案列表
 */
router.get('/schemes', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const schemesDir = getUserSchemesDir(userId);

    // 确保目录存在
    await ensureDir(schemesDir);

    // 读取所有方案文件
    const entries = await readDir(schemesDir);
    const schemes = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const schemePath = path.join(schemesDir, entry.name);
        const schemeData = await readJson(schemePath);
        if (schemeData) {
          schemes.push({
            id: schemeData.id,
            name: schemeData.name,
            isPreset: schemeData.isPreset || false,
            userId: schemeData.userId,
            createdAt: schemeData.createdAt,
            updatedAt: schemeData.updatedAt,
          });
        }
      }
    }

    // 按创建时间倒序排序
    schemes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(successResponse(schemes));
  } catch (error) {
    console.error('Get schemes error:', error);
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
 * GET /api/watermark/schemes/:id
 * 获取方案详情
 */
router.get('/schemes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const schemePath = getSchemePath(userId, id);
    const schemeData = await readJson(schemePath);

    if (!schemeData) {
      throw new ApiError(404, 'SCHEME_NOT_FOUND', '方案不存在');
    }

    res.json(successResponse(schemeData));
  } catch (error) {
    console.error('Get scheme error:', error);
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
 * POST /api/watermark/schemes
 * 创建方案
 */
router.post('/schemes', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, watermark, isPreset } = req.body;

    // 验证必填参数
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new ApiError(400, 'VALIDATION_ERROR', '方案名称不能为空');
    }

    if (!watermark || typeof watermark !== 'object') {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印配置无效');
    }

    // 验证水印参数
    const wm = watermark;
    if (typeof wm.text !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印文字必须是字符串');
    }
    if (typeof wm.x !== 'number' || wm.x < 0 || wm.x > 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印 X 坐标必须在 0-1 之间');
    }
    if (typeof wm.y !== 'number' || wm.y < 0 || wm.y > 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印 Y 坐标必须在 0-1 之间');
    }
    if (typeof wm.scale !== 'number' || wm.scale < 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印缩放必须大于等于 0');
    }
    if (typeof wm.rotation !== 'number' || wm.rotation < -360 || wm.rotation > 360) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印旋转角度必须在 -360 到 360 之间');
    }
    if (typeof wm.opacity !== 'number' || wm.opacity < 0 || wm.opacity > 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印透明度必须在 0-1 之间');
    }
    if (typeof wm.font !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印字体必须是字符串');
    }
    if (typeof wm.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(wm.color)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印颜色必须是有效的十六进制颜色码');
    }

    const now = new Date().toISOString();
    const schemeId = generateSchemeId();

    const schemeData = {
      id: schemeId,
      name: name.trim(),
      isPreset: Boolean(isPreset),
      userId,
      createdAt: now,
      updatedAt: now,
      watermark: {
        text: wm.text,
        x: wm.x,
        y: wm.y,
        scale: wm.scale,
        rotation: wm.rotation,
        opacity: wm.opacity,
        font: wm.font,
        color: wm.color,
      },
    };

    const schemePath = getSchemePath(userId, schemeId);
    await writeJson(schemePath, schemeData);

    res.status(201).json(successResponse(schemeData));
  } catch (error) {
    console.error('Create scheme error:', error);
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
 * PUT /api/watermark/schemes/:id
 * 更新方案
 */
router.put('/schemes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, watermark, isPreset } = req.body;

    const schemePath = getSchemePath(userId, id);
    const existingScheme = await readJson(schemePath);

    if (!existingScheme) {
      throw new ApiError(404, 'SCHEME_NOT_FOUND', '方案不存在');
    }

    // 验证水印参数（如果提供）
    if (watermark) {
      const wm = watermark;
      if (typeof wm.text !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印文字必须是字符串');
      }
      if (typeof wm.x !== 'number' || wm.x < 0 || wm.x > 1) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印 X 坐标必须在 0-1 之间');
      }
      if (typeof wm.y !== 'number' || wm.y < 0 || wm.y > 1) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印 Y 坐标必须在 0-1 之间');
      }
      if (typeof wm.scale !== 'number' || wm.scale < 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印缩放必须大于等于 0');
      }
      if (typeof wm.rotation !== 'number' || wm.rotation < -360 || wm.rotation > 360) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印旋转角度必须在 -360 到 360 之间');
      }
      if (typeof wm.opacity !== 'number' || wm.opacity < 0 || wm.opacity > 1) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印透明度必须在 0-1 之间');
      }
      if (typeof wm.font !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印字体必须是字符串');
      }
      if (typeof wm.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(wm.color)) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印颜色必须是有效的十六进制颜色码');
      }
    }

    const updatedScheme = {
      ...existingScheme,
      name: name && typeof name === 'string' ? name.trim() : existingScheme.name,
      isPreset: typeof isPreset === 'boolean' ? isPreset : existingScheme.isPreset,
      watermark: watermark ? {
        text: watermark.text,
        x: watermark.x,
        y: watermark.y,
        scale: watermark.scale,
        rotation: watermark.rotation,
        opacity: watermark.opacity,
        font: watermark.font,
        color: watermark.color,
      } : existingScheme.watermark,
      updatedAt: new Date().toISOString(),
    };

    await writeJson(schemePath, updatedScheme);

    res.json(successResponse(updatedScheme));
  } catch (error) {
    console.error('Update scheme error:', error);
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
 * DELETE /api/watermark/schemes/:id
 * 删除方案
 */
router.delete('/schemes/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const schemePath = getSchemePath(userId, id);

    // 检查方案是否存在
    if (!(await exists(schemePath))) {
      throw new ApiError(404, 'SCHEME_NOT_FOUND', '方案不存在');
    }

    // 删除方案文件
    await remove(schemePath);

    res.json(successResponse({ deleted: true, id }));
  } catch (error) {
    console.error('Delete scheme error:', error);
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
 * POST /api/watermark/schemes/export/:id
 * 导出方案为文件下载
 */
router.post('/schemes/export/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { fileName } = req.body || {};

    const schemePath = getSchemePath(userId, id);
    const schemeData = await readJson(schemePath);

    if (!schemeData) {
      throw new ApiError(404, 'SCHEME_NOT_FOUND', '方案不存在');
    }

    // 生成导出文件名
    const exportFileName = fileName && typeof fileName === 'string'
      ? fileName
      : `${schemeData.name}_${Date.now()}.json`;

    // 直接返回 JSON 文件下载
    const jsonContent = JSON.stringify(schemeData, null, 2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);
    res.send(jsonContent);
  } catch (error) {
    console.error('Export scheme error:', error);
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
 * POST /api/watermark/schemes/import
 * 导入方案（支持 multipart/form-data）
 */
router.post('/schemes/import', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 支持两种格式：JSON body 或 multipart/form-data
    let scheme;

    if (req.body && req.body.scheme) {
      // JSON 格式
      scheme = typeof req.body.scheme === 'string' ? JSON.parse(req.body.scheme) : req.body.scheme;
    } else if (req.file) {
      // multipart/form-data 格式
      try {
        scheme = JSON.parse(req.file.buffer.toString());
      } catch (e) {
        throw new ApiError(400, 'VALIDATION_ERROR', '无效的方案文件');
      }
    } else {
      throw new ApiError(400, 'VALIDATION_ERROR', '缺少方案数据');
    }

    // 验证方案数据
    if (!scheme || typeof scheme !== 'object') {
      throw new ApiError(400, 'VALIDATION_ERROR', '方案数据无效');
    }

    if (!scheme.watermark || typeof scheme.watermark !== 'object') {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印配置无效');
    }

    const wm = scheme.watermark;
    if (typeof wm.text !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印文字必须是字符串');
    }
    if (typeof wm.x !== 'number' || wm.x < 0 || wm.x > 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印 X 坐标必须在 0-1 之间');
    }
    if (typeof wm.y !== 'number' || wm.y < 0 || wm.y > 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印 Y 坐标必须在 0-1 之间');
    }
    if (typeof wm.scale !== 'number' || wm.scale < 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印缩放必须大于等于 0');
    }
    if (typeof wm.rotation !== 'number' || wm.rotation < -360 || wm.rotation > 360) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印旋转角度必须在 -360 到 360 之间');
    }
    if (typeof wm.opacity !== 'number' || wm.opacity < 0 || wm.opacity > 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印透明度必须在 0-1 之间');
    }
    if (typeof wm.font !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印字体必须是字符串');
    }
    if (typeof wm.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(wm.color)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '水印颜色必须是有效的十六进制颜色码');
    }

    const now = new Date().toISOString();
    const schemeId = generateSchemeId();

    const schemeData = {
      id: schemeId,
      name: scheme.name && typeof scheme.name === 'string' ? scheme.name.trim() : '未命名方案',
      isPreset: false, // 导入的方案不是预设
      userId,
      createdAt: now,
      updatedAt: now,
      watermark: {
        text: wm.text,
        x: wm.x,
        y: wm.y,
        scale: wm.scale,
        rotation: wm.rotation,
        opacity: wm.opacity,
        font: wm.font,
        color: wm.color,
      },
    };

    const schemePath = getSchemePath(userId, schemeId);
    await writeJson(schemePath, schemeData);

    res.status(201).json(successResponse(schemeData));
  } catch (error) {
    console.error('Import scheme error:', error);
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
