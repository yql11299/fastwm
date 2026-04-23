/**
 * Jest 测试设置文件
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { exists } from '../../src/utils/fileManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试专用目录
export const TEST_USERS_DIR = path.resolve(__dirname, '../test_users');
export const TEST_DOCUMENTS_DIR = path.resolve(__dirname, '../test_documents');
export const TEST_EXPORTS_DIR = path.resolve(__dirname, '../test_exports');
export const TEST_FONTS_DIR = path.resolve(__dirname, '../test_fonts');
export const TEST_BACKGROUNDS_DIR = path.resolve(__dirname, '../test_backgrounds');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.FONTS_PATH = TEST_FONTS_DIR;
process.env.USERS_PATH = TEST_USERS_DIR;
process.env.DOCUMENTS_PATH = TEST_DOCUMENTS_DIR;
process.env.EXPORTS_PATH = TEST_EXPORTS_DIR;
process.env.BACKGROUNDS_PATH = TEST_BACKGROUNDS_DIR;

/**
 * 清理测试用户目录
 */
export async function cleanupTestUsers() {
  try {
    if (await exists(TEST_USERS_DIR)) {
      await fs.rm(TEST_USERS_DIR, { recursive: true, force: true });
    }
    // 重建空目录
    await fs.mkdir(TEST_USERS_DIR, { recursive: true });
  } catch (error) {
    console.error('Cleanup test users failed:', error);
  }
}

/**
 * 清理测试导出目录
 */
export async function cleanupTestExports() {
  try {
    if (await exists(TEST_EXPORTS_DIR)) {
      await fs.rm(TEST_EXPORTS_DIR, { recursive: true, force: true });
    }
    await fs.mkdir(TEST_EXPORTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Cleanup test exports failed:', error);
  }
}

/**
 * 清理所有测试数据
 */
export async function cleanupAllTestData() {
  await cleanupTestUsers();
  await cleanupTestExports();
}

// 清理全局状态
afterAll(async () => {
  await cleanupAllTestData();
  // 等待所有异步操作完成
  await new Promise((resolve) => setTimeout(resolve, 100));
});
