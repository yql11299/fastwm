/**
 * Jest 测试设置文件 - 水印处理模块
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
 * 设置测试字体目录（同步版本，在 Jest 加载前执行）
 */
async function ensureTestFontsExist() {
  try {
    // 检查字体目录是否存在且有字体文件
    try {
      const files = await fs.readdir(TEST_FONTS_DIR);
      const hasFonts = files.some(f => f.endsWith('.ttf') || f.endsWith('.otf'));
      if (hasFonts) {
        console.log(`[setup] 测试字体已存在: ${TEST_FONTS_DIR}`);
        return;
      }
    } catch {
      // 目录不存在或无法读取，继续创建
    }

    // 创建测试字体目录
    await fs.mkdir(TEST_FONTS_DIR, { recursive: true });

    // 实际的字体目录（相对于 server 目录）
    const realFontsDir = path.resolve(__dirname, '../../fonts');

    // 检查实际字体目录是否存在
    try {
      await fs.access(realFontsDir);
    } catch {
      console.warn(`[setup] 实际字体目录不存在: ${realFontsDir}`);
      return;
    }

    // 复制所有 TTF 和 OTF 字体文件
    const files = await fs.readdir(realFontsDir);
    for (const file of files) {
      if (file.endsWith('.ttf') || file.endsWith('.otf')) {
        const src = path.join(realFontsDir, file);
        const dest = path.join(TEST_FONTS_DIR, file);
        await fs.copyFile(src, dest);
        console.log(`[setup] 复制字体: ${file}`);
      }
    }
  } catch (error) {
    console.error('[setup] 设置测试字体失败:', error);
  }
}

// 立即执行字体设置（同步）
ensureTestFontsExist();

/**
 * 清理测试用户目录
 */
export async function cleanupTestUsers() {
  try {
    if (await exists(TEST_USERS_DIR)) {
      await fs.rm(TEST_USERS_DIR, { recursive: true, force: true });
    }
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

/**
 * 创建测试水印方案
 * @param {string} userId - 用户ID
 * @param {string} schemeId - 方案ID
 * @param {Object} watermarkConfig - 水印配置
 * @returns {Promise<string>} 方案ID
 */
export async function createTestScheme(userId, schemeId = 'test_scheme_001', watermarkConfig = {}) {
  const schemeDir = path.join(TEST_USERS_DIR, userId, 'schemes');
  await fs.mkdir(schemeDir, { recursive: true });

  const scheme = {
    id: schemeId,
    name: watermarkConfig.name || '测试方案',
    isPreset: watermarkConfig.isPreset !== false,
    userId: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    watermark: {
      text: watermarkConfig.text || '默认水印文字',
      x: watermarkConfig.x ?? 0.5,
      y: watermarkConfig.y ?? 0.5,
      scale: watermarkConfig.scale ?? 0.05,
      rotation: watermarkConfig.rotation ?? 0,
      opacity: watermarkConfig.opacity ?? 0.8,
      font: watermarkConfig.font || '黑体',
      color: watermarkConfig.color || '#808080',
    },
  };

  await fs.writeFile(
    path.join(schemeDir, `${schemeId}.json`),
    JSON.stringify(scheme, null, 2)
  );

  return schemeId;
}

/**
 * 创建带默认水印配置的用户
 * @param {string} userId - 用户ID
 * @param {Object} defaultWatermark - 默认水印配置
 */
export async function createTestUserWithDefaultWatermark(userId, defaultWatermark = {}) {
  // 使用与应用相同的用户目录（不是测试专用目录）
  const { config } = await import('../../src/config/index.js');
  const userDir = path.join(config.dirs.users, userId);
  await fs.mkdir(userDir, { recursive: true });

  const userSettings = {
    id: userId,
    username: userId,
    createdAt: new Date().toISOString(),
    export: {
      namingRule: 'timestamp_text',
      quality: 100,
    },
    defaultWatermark: {
      text: defaultWatermark.text ?? '用户默认水印',
      x: defaultWatermark.x ?? 0.5,
      y: defaultWatermark.y ?? 0.5,
      scale: defaultWatermark.scale ?? 0.05,
      rotation: defaultWatermark.rotation ?? 0,
      opacity: defaultWatermark.opacity ?? 0.8,
      font: defaultWatermark.font || '黑体',
      color: defaultWatermark.color || '#808080',
    },
  };

  await fs.writeFile(
    path.join(userDir, 'settings.json'),
    JSON.stringify(userSettings, null, 2)
  );
}

// 清理全局状态
afterAll(async () => {
  await cleanupAllTestData();
  await new Promise((resolve) => setTimeout(resolve, 100));
});
