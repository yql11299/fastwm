/**
 * 认证中间件
 * 验证 Cookie 中的 token
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { ApiError } from '../utils/response.js';
import { readJson, ensureDir } from '../utils/fileManager.js';
import path from 'path';

/**
 * 从请求中提取 token（支持 Cookie 和 Authorization header）
 * @param {Request} req - Express 请求对象
 * @returns {string|null}
 */
function extractToken(req) {
  // 优先从 Cookie 中提取
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  
  // 从 Authorization header 中提取
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * 验证 JWT token 并获取用户信息
 * @param {string} token - JWT token
 * @returns {Promise<Object>} 用户信息
 */
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'Token 已过期');
    }
    throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'Token 无效');
  }
}

/**
 * 从用户目录读取用户数据
 * @param {string} userId - 用户ID
 * @returns {Promise<Object|null>}
 */
async function getUserFromStorage(userId) {
  const userFilePath = path.join(config.dirs.users, userId, 'settings.json');
  const userData = await readJson(userFilePath);
  return userData;
}

/**
 * 认证中间件
 * 验证请求中的 token，有效则将用户信息附加到 req.user
 */
export async function authMiddleware(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', '未提供认证 token');
    }

    // 验证 token
    const decoded = await verifyToken(token);

    // 验证用户是否仍然存在
    const userData = await getUserFromStorage(decoded.id);
    if (!userData) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', '用户不存在');
    }

    // 将用户信息附加到请求对象
    req.user = {
      id: decoded.id,
      username: decoded.username,
      createdAt: decoded.createdAt,
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      });
    }
    // 未知错误
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
}

/**
 * 可选的认证中间件
 * 如果有 token 则验证，没有则继续（用于公开接口但需要用户信息的场景）
 */
export async function optionalAuthMiddleware(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = await verifyToken(token);
      const userData = await getUserFromStorage(decoded.id);
      if (userData) {
        req.user = {
          id: decoded.id,
          username: decoded.username,
          createdAt: decoded.createdAt,
        };
      }
    }

    next();
  } catch {
    // 验证失败时继续，不阻止请求
    next();
  }
}

/**
 * 生成 JWT token
 * @param {Object} user - 用户信息
 * @returns {string} JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export default {
  authMiddleware,
  optionalAuthMiddleware,
  generateToken,
  verifyToken,
};
