/**
 * 清理工具
 * 清理过期的导出文件
 */

import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))}${sizes[i]}`;
}

/**
 * 检查目录是否过期
 * @param {string} dirPath - 目录路径
 * @param {number} maxAge - 最大年龄（毫秒）
 * @returns {Promise<boolean>}
 */
async function isExpired(dirPath, maxAge) {
  try {
    const stats = await fs.stat(dirPath);
    const age = Date.now() - stats.mtime.getTime();
    return age > maxAge;
  } catch {
    return false;
  }
}

/**
 * 获取目录大小
 * @param {string} dirPath - 目录路径
 * @returns {Promise<number>}
 */
async function getDirSize(dirPath) {
  let totalSize = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await getDirSize(entryPath);
      } else {
        const stats = await fs.stat(entryPath);
        totalSize += stats.size;
      }
    }
  } catch {
    // 忽略错误
  }

  return totalSize;
}

/**
 * 删除目录及其内容
 * @param {string} dirPath - 目录路径
 */
async function removeDir(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // 忽略错误
  }
}

/**
 * 清理过期的导出文件
 * @param {number} maxAge - 最大保留时间（毫秒），默认 24 小时
 * @returns {Promise<Object>}
 */
async function cleanupExports(maxAge = config.limits.exportExpiration) {
  const exportsDir = config.dirs.exports;

  let cleaned = 0;
  let freedSpace = 0;

  try {
    // 确保目录存在
    const entries = await fs.readdir(exportsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const dirPath = path.join(exportsDir, entry.name);

      // 检查是否过期
      if (await isExpired(dirPath, maxAge)) {
        // 计算目录大小
        const dirSize = await getDirSize(dirPath);

        // 删除目录
        await removeDir(dirPath);

        cleaned++;
        freedSpace += dirSize;
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    // 不抛出错误，只是记录
  }

  return {
    cleaned,
    freedSpace: formatSize(freedSpace),
    freedBytes: freedSpace,
  };
}

/**
 * 清理所有导出文件（谨慎使用）
 * @returns {Promise<Object>}
 */
async function cleanupAllExports() {
  const exportsDir = config.dirs.exports;

  let cleaned = 0;
  let freedSpace = 0;

  try {
    const entries = await fs.readdir(exportsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const dirPath = path.join(exportsDir, entry.name);
      const dirSize = await getDirSize(dirPath);

      await removeDir(dirPath);

      cleaned++;
      freedSpace += dirSize;
    }
  } catch (error) {
    console.error('Cleanup all error:', error);
  }

  return {
    cleaned,
    freedSpace: formatSize(freedSpace),
    freedBytes: freedSpace,
  };
}

/**
 * 获取导出目录统计信息
 * @returns {Promise<Object>}
 */
async function getExportStats() {
  const exportsDir = config.dirs.exports;

  let totalDirs = 0;
  let totalFiles = 0;
  let totalSize = 0;
  const dirInfo = [];

  try {
    const entries = await fs.readdir(exportsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      totalDirs++;
      const dirPath = path.join(exportsDir, entry.name);

      try {
        const subEntries = await fs.readdir(dirPath, { withFileTypes: true });
        const dirFiles = subEntries.filter((e) => !e.isDirectory()).length;
        const dirSize = await getDirSize(dirPath);

        totalFiles += dirFiles;
        totalSize += dirSize;

        dirInfo.push({
          name: entry.name,
          files: dirFiles,
          size: formatSize(dirSize),
          age: Date.now() - (await fs.stat(dirPath)).mtime.getTime(),
        });
      } catch {
        // 忽略错误
      }
    }
  } catch (error) {
    // 目录不存在
  }

  return {
    totalDirs,
    totalFiles,
    totalSize: formatSize(totalSize),
    totalBytes: totalSize,
    dirs: dirInfo,
  };
}

/**
 * 启动定期清理任务
 * @param {number} intervalHours - 清理间隔（小时）
 */
function startPeriodicCleanup(intervalHours = 24) {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  // 立即执行一次
  cleanupExports().catch(console.error);

  // 设置定时任务
  setInterval(
    () => {
      cleanupExports().catch(console.error);
    },
    intervalMs
  );

  console.log(`清理任务已启动，每 ${intervalHours} 小时执行一次`);
}

export default {
  cleanupExports,
  cleanupAllExports,
  getExportStats,
  startPeriodicCleanup,
  formatSize,
  isExpired,
  getDirSize,
};
