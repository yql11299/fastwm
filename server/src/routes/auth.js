/**
 * 用户认证路由
 * 处理用户登录、登出、当前用户获取、用户列表等功能
 */

import express from 'express';
import { config } from '../config/index.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { readJson, writeJson, ensureDir, exists } from '../utils/fileManager.js';
import { successResponse, ApiError } from '../utils/response.js';
import path from 'path';

const router = express.Router();

/**
 * 获取用户目录路径
 * @param {string} userId - 用户ID
 * @returns {string}
 */
function getUserDir(userId) {
  return path.join(config.dirs.users, userId);
}

/**
 * 获取用户数据文件路径
 * @param {string} userId - 用户ID
 * @returns {string}
 */
function getUserFilePath(userId) {
  return path.join(getUserDir(userId), 'settings.json');
}

/**
 * 确保用户目录存在
 * @param {string} userId - 用户ID
 */
async function ensureUserDir(userId) {
  const userDir = getUserDir(userId);
  await ensureDir(userDir);

  // 确保子目录存在（schemes 目录）
  await ensureDir(path.join(userDir, 'schemes'));
}

/**
 * 初始化用户数据
 * @param {string} userId - 用户ID
 * @returns {Object} 用户数据
 */
async function initializeUserData(userId) {
  const now = new Date().toISOString();
  const userData = {
    id: userId,
    username: userId,
    createdAt: now,
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
      opacity: 1,
      font: '黑体',
      color: '#808080',
    },
  };

  const userFilePath = getUserFilePath(userId);
  await writeJson(userFilePath, userData);
  return userData;
}

/**
 * 获取所有用户列表
 * @returns {Promise<Array>}
 */
async function getAllUsers() {
  await ensureDir(config.dirs.users);

  // 直接列出目录中的子目录
  const fs = await import('fs/promises');
  let userDirs = [];

  try {
    const items = await fs.readdir(config.dirs.users, { withFileTypes: true });
    userDirs = items
      .filter((item) => item.isDirectory())
      .map((item) => item.name);
  } catch {
    return [];
  }

  const users = [];
  for (const userId of userDirs) {
    const userData = await readJson(getUserFilePath(userId));
    if (userData) {
      users.push({
        id: userData.id,
        username: userData.username,
        createdAt: userData.createdAt,
      });
    }
  }

  return users;
}

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;

    // 验证用户名存在且为字符串
    if (!username || typeof username !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户名不能为空');
    }

    // 去除首尾空格
    const trimmedUsername = username.trim();

    // 验证去除空格后不为空
    if (trimmedUsername === '') {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户名不能为空');
    }

    // 验证不包含控制字符（换行、回车、制表符等）
    if (/[\x00-\x1f\x7f]/.test(trimmedUsername)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户名包含非法字符');
    }

    // 验证长度限制（最大 100 字符）
    if (trimmedUsername.length > 100) {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户名过长');
    }

    const userId = trimmedUsername.toLowerCase();

    // 检查用户是否存在
    const userFilePath = getUserFilePath(userId);
    let userData = await readJson(userFilePath);

    if (!userData) {
      // 用户不存在，创建新用户
      await ensureUserDir(userId);
      userData = await initializeUserData(userId);
    }

    // 生成 token
    const token = generateToken(userData);

    // 设置 cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
      sameSite: 'lax',
    });

    res.json(
      successResponse({
        token,
        user: {
          id: userData.id,
          username: userData.username,
          createdAt: userData.createdAt,
        },
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
    console.error('Login error:', error);
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
 * POST /api/auth/logout
 * 用户登出
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json(successResponse({}));
});

/**
 * GET /api/auth/current
 * 获取当前登录用户
 */
router.get('/current', authMiddleware, async (req, res) => {
  try {
    // req.user 由 authMiddleware 设置
    if (!req.user) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', '用户未登录');
    }

    const userData = await readJson(getUserFilePath(req.user.id));
    if (!userData) {
      throw new ApiError(404, 'AUTH_USER_NOT_FOUND', '用户不存在');
    }

    res.json(
      successResponse({
        id: userData.id,
        username: userData.username,
        createdAt: userData.createdAt,
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
    console.error('Get current user error:', error);
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
 * GET /api/auth/users
 * 获取用户列表
 */
router.get('/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(successResponse(users));
  } catch (error) {
    console.error('Get users error:', error);
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
 * POST /api/auth/users
 * 创建新用户
 */
router.post('/users', async (req, res) => {
  try {
    const { username } = req.body;

    // 验证用户名存在且为字符串
    if (!username || typeof username !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户名不能为空');
    }

    // 去除首尾空格
    const trimmedUsername = username.trim();

    // 验证去除空格后不为空
    if (trimmedUsername === '') {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户名不能为空');
    }

    // 验证不包含控制字符（换行、回车、制表符等）
    if (/[\x00-\x1f\x7f]/.test(trimmedUsername)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户名包含非法字符');
    }

    // 验证长度限制（最大 100 字符）
    if (trimmedUsername.length > 100) {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户名过长');
    }

    const userId = trimmedUsername.toLowerCase();

    // 检查用户是否已存在
    if (await exists(getUserFilePath(userId))) {
      throw new ApiError(400, 'VALIDATION_ERROR', '用户已存在');
    }

    // 创建用户
    await ensureUserDir(userId);
    const userData = await initializeUserData(userId);

    res.status(201).json(
      successResponse({
        id: userData.id,
        username: userData.username,
        createdAt: userData.createdAt,
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
    console.error('Create user error:', error);
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
