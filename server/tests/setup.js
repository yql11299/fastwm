/**
 * Jest 测试设置文件
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.FONTS_PATH = path.resolve(__dirname, '../fonts');
process.env.USERS_PATH = path.resolve(__dirname, '../test_users');
process.env.DOCUMENTS_PATH = path.resolve(__dirname, '../test_documents');
process.env.EXPORTS_PATH = path.resolve(__dirname, '../test_exports');

// 清理全局状态
afterAll(async () => {
  // 等待所有异步操作完成
  await new Promise((resolve) => setTimeout(resolve, 100));
});
