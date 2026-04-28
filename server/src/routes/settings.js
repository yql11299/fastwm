/**
 * 设置管理路由
 * 处理用户设置的获取和更新
 */

import express from 'express';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { readJson, writeJson, ensureDir, exists } from '../utils/fileManager.js';
import { successResponse, ApiError } from '../utils/response.js';
import path from 'path';

const router = express.Router();

/**
 * 获取用户设置文件路径
 * @param {string} userId - 用户ID
 * @returns {string}
 */
function getUserSettingsPath(userId) {
  return path.join(config.dirs.users, userId, 'settings.json');
}

/**
 * GET /api/settings
 * 获取用户设置
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const settingsPath = getUserSettingsPath(userId);

    // 检查设置文件是否存在
    const settingsData = await readJson(settingsPath);

    if (!settingsData) {
      // 如果不存在，返回默认设置
      return res.json(successResponse({
        userId,
        export: {
          namingRule: 'timestamp_text',
          quality: 100,
        },
        defaultWatermark: {
          text: '',
          x: 0.5,
          y: 0.5,
          scale: 0.05,
          rotation: 0,
          opacity: 0.8,
          font: '黑体',
          color: '#808080',
        },
      }));
    }

    res.json(successResponse(settingsData));
  } catch (error) {
    console.error('Get settings error:', error);
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
 * PUT /api/settings
 * 更新用户设置
 */
router.put('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { export: exportSettings, defaultWatermark } = req.body;

    const settingsPath = getUserSettingsPath(userId);

    // 读取现有设置
    let settingsData = await readJson(settingsPath);

    if (!settingsData) {
      // 如果不存在，创建默认设置
      settingsData = {
        id: userId,
        username: userId,
        createdAt: new Date().toISOString(),
        export: {
          namingRule: 'timestamp_text',
          quality: 100,
        },
        defaultWatermark: {
          text: '',
          x: 0.5,
          y: 0.5,
          scale: 0.05,
          rotation: 0,
          opacity: 0.8,
          font: '黑体',
          color: '#808080',
        },
      };
    }

    // 更新导出设置
    if (exportSettings && typeof exportSettings === 'object') {
      if (exportSettings.namingRule === 'string') {
        const validNamingRules = ['original', 'timestamp', 'text', 'timestamp_text'];
        if (!validNamingRules.includes(exportSettings.namingRule)) {
          throw new ApiError(400, 'VALIDATION_ERROR', '无效的命名规则');
        }
        settingsData.export = {
          ...settingsData.export,
          namingRule: exportSettings.namingRule,
        };
      }
      if (typeof exportSettings.quality === 'number') {
        if (exportSettings.quality < 1 || exportSettings.quality > 100) {
          throw new ApiError(400, 'VALIDATION_ERROR', '导出质量必须在 1-100 之间');
        }
        settingsData.export = {
          ...settingsData.export,
          quality: exportSettings.quality,
        };
      }
    }

    // 更新默认水印设置
    if (defaultWatermark && typeof defaultWatermark === 'object') {
      const wm = defaultWatermark;

      // 验证水印参数
      if (wm.text !== undefined && typeof wm.text !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印文字必须是字符串');
      }
      if (wm.x !== undefined && (typeof wm.x !== 'number' || wm.x < 0 || wm.x > 1)) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印 X 坐标必须在 0-1 之间');
      }
      if (wm.y !== undefined && (typeof wm.y !== 'number' || wm.y < 0 || wm.y > 1)) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印 Y 坐标必须在 0-1 之间');
      }
      if (wm.scale !== undefined && (typeof wm.scale !== 'number' || wm.scale < 0)) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印缩放必须大于等于 0');
      }
      if (wm.rotation !== undefined && (typeof wm.rotation !== 'number' || wm.rotation < -360 || wm.rotation > 360)) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印旋转角度必须在 -360 到 360 之间');
      }
      if (wm.opacity !== undefined && (typeof wm.opacity !== 'number' || wm.opacity < 0 || wm.opacity > 1)) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印透明度必须在 0-1 之间');
      }
      if (wm.font !== undefined && typeof wm.font !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印字体必须是字符串');
      }
      if (wm.color !== undefined && (typeof wm.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(wm.color))) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印颜色必须是有效的十六进制颜色码');
      }

      settingsData.defaultWatermark = {
        ...settingsData.defaultWatermark,
        text: wm.text !== undefined ? wm.text : settingsData.defaultWatermark.text,
        x: wm.x !== undefined ? wm.x : settingsData.defaultWatermark.x,
        y: wm.y !== undefined ? wm.y : settingsData.defaultWatermark.y,
        scale: wm.scale !== undefined ? wm.scale : settingsData.defaultWatermark.scale,
        rotation: wm.rotation !== undefined ? wm.rotation : settingsData.defaultWatermark.rotation,
        opacity: wm.opacity !== undefined ? wm.opacity : settingsData.defaultWatermark.opacity,
        font: wm.font !== undefined ? wm.font : settingsData.defaultWatermark.font,
        color: wm.color !== undefined ? wm.color : settingsData.defaultWatermark.color,
      };
    }

    // 保存更新后的设置
    await writeJson(settingsPath, settingsData);

    res.json(successResponse(settingsData));
  } catch (error) {
    console.error('Update settings error:', error);
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
