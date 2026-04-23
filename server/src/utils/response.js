/**
 * 统一 API 响应格式工具
 */

/**
 * 成功响应
 * @param {any} data - 响应数据
 * @returns {Object} 格式化后的响应对象
 */
export function successResponse(data) {
  return {
    success: true,
    data,
    error: null,
  };
}

/**
 * 错误响应
 * @param {string} code - 错误码
 * @param {string} message - 错误消息
 * @param {Object} details - 错误详情
 * @returns {Object} 格式化后的响应对象
 */
export function errorResponse(code, message, details = null) {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

/**
 * 创建 HTTP 错误
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export default { successResponse, errorResponse, ApiError };
