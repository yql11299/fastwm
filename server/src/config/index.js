import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 根目录
const ROOT_DIR = path.resolve(__dirname, '../../..');

// 服务器配置
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // 目录配置
  dirs: {
    root: ROOT_DIR,
    // 后端数据目录（与 src 平级）
    data: path.join(ROOT_DIR, 'server/data'),
    fonts: process.env.FONTS_PATH || path.join(ROOT_DIR, 'fonts'),
    // 用户数据目录
    users: process.env.USERS_PATH || path.join(ROOT_DIR, 'server/data/users'),
    // 证件文件目录
    documents: process.env.DOCUMENTS_PATH || path.join(ROOT_DIR, 'server/documents'),
    exports: process.env.EXPORTS_PATH || path.join(ROOT_DIR, 'exports'),
    backgrounds: process.env.BACKGROUNDS_PATH || path.join(ROOT_DIR, 'backgrounds'),
  },

  // JWT 配置
  jwt: {
    // 生产环境必须配置环境变量
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('JWT_SECRET environment variable is required in production'); })()
      : 'dev-only-secret-do-not-use-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 处理限制
  limits: {
    maxFilesPerBatch: 100,
    maxFileSize: 20 * 1024 * 1024, // 20MB
    exportExpiration: 24 * 60 * 60 * 1000, // 24小时
  },

  // 支持的文件类型
  supportedFileTypes: {
    documents: ['jpg', 'jpeg', 'png', 'pdf'],
    fonts: ['ttf', 'otf'], // 不支持 ttc
  },

  // API 响应格式
  api: {
    successCode: 'SUCCESS',
    errorCodes: {
      AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
      AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
      DOC_FILE_NOT_FOUND: 'DOC_FILE_NOT_FOUND',
      DOC_FILE_TOO_LARGE: 'DOC_FILE_TOO_LARGE',
      SCHEME_NOT_FOUND: 'SCHEME_NOT_FOUND',
      PROCESS_FAILED: 'PROCESS_FAILED',
      LAYOUT_SAVE_FAILED: 'LAYOUT_SAVE_FAILED',
      VALIDATION_ERROR: 'VALIDATION_ERROR',
    },
  },
};

export default config;
