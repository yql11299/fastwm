/**
 * 文件管理器工具
 * 提供 JSON 文件读写和目录操作功能
 */

import fs from 'fs/promises';
import path from 'path';
import { ApiError } from './response.js';

/**
 * 确保目录存在，不存在则创建
 * @param {string} dirPath - 目录路径
 */
export async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * 检查文件/目录是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>}
 */
export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取 JSON 文件
 * @param {string} filePath - JSON 文件路径
 * @returns {Promise<Object>} 解析后的 JSON 对象
 */
export async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new ApiError(500, 'FILE_READ_ERROR', `读取文件失败: ${filePath}`, {
      originalError: error.message,
    });
  }
}

/**
 * 写入 JSON 文件
 * @param {string} filePath - JSON 文件路径
 * @param {Object} data - 要写入的数据
 */
export async function writeJson(filePath, data) {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    await ensureDir(dir);

    // 写入文件
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new ApiError(500, 'FILE_WRITE_ERROR', `写入文件失败: ${filePath}`, {
      originalError: error.message,
    });
  }
}

/**
 * 读取目录内容
 * @param {string} dirPath - 目录路径
 * @returns {Promise<string[]>} 文件/目录名列表
 */
export async function readDir(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw new ApiError(500, 'DIR_READ_ERROR', `读取目录失败: ${dirPath}`, {
      originalError: error.message,
    });
  }
}

/**
 * 获取文件信息
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 文件信息
 */
export async function getFileInfo(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    throw new ApiError(500, 'FILE_INFO_ERROR', `获取文件信息失败: ${filePath}`, {
      originalError: error.message,
    });
  }
}

/**
 * 复制文件
 * @param {string} src - 源文件路径
 * @param {string} dest - 目标文件路径
 */
export async function copyFile(src, dest) {
  try {
    const destDir = path.dirname(dest);
    await ensureDir(destDir);
    await fs.copyFile(src, dest);
  } catch (error) {
    throw new ApiError(500, 'FILE_COPY_ERROR', `复制文件失败: ${src} -> ${dest}`, {
      originalError: error.message,
    });
  }
}

/**
 * 删除文件或目录（如果是空目录）
 * @param {string} filePath - 文件/目录路径
 */
export async function remove(filePath) {
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await fs.rm(filePath, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new ApiError(500, 'FILE_REMOVE_ERROR', `删除文件失败: ${filePath}`, {
        originalError: error.message,
      });
    }
  }
}

/**
 * 读取二进制文件
 * @param {string} filePath - 文件路径
 * @returns {Promise<Buffer>}
 */
export async function readFile(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw new ApiError(500, 'FILE_READ_ERROR', `读取文件失败: ${filePath}`, {
      originalError: error.message,
    });
  }
}

/**
 * 写入二进制文件
 * @param {string} filePath - 文件路径
 * @param {Buffer|Uint8Array} data - 数据
 */
export async function writeFile(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    await ensureDir(dir);
    await fs.writeFile(filePath, data);
  } catch (error) {
    throw new ApiError(500, 'FILE_WRITE_ERROR', `写入文件失败: ${filePath}`, {
      originalError: error.message,
    });
  }
}

export default {
  ensureDir,
  exists,
  readJson,
  writeJson,
  readDir,
  getFileInfo,
  copyFile,
  remove,
  readFile,
  writeFile,
};
