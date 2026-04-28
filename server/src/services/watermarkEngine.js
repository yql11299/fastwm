/**
 * 水印处理引擎
 * 整合 textToPath 和 pdfRenderer，处理批量文件水印
 */

import path from 'path';
import fs from 'fs/promises';
import archiver from 'archiver';
import { config } from '../config/index.js';
import { ApiError } from '../utils/response.js';
import { ensureDir, exists, getFileInfo } from '../utils/fileManager.js';
import pdfRenderer from './pdfRenderer.js';
import textToPath from './textToPath.js';

// 任务状态存储
const taskStore = new Map();

/**
 * 创建任务
 * @param {string} taskId - 任务ID
 * @param {number} total - 总文件数
 * @returns {Object}
 */
function createTask(taskId, total) {
  const task = {
    taskId,
    status: 'processing',
    total,
    processed: 0,
    results: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  taskStore.set(taskId, task);
  return task;
}

/**
 * 获取任务状态
 * @param {string} taskId - 任务ID
 * @returns {Object|null}
 */
function getTask(taskId) {
  return taskStore.get(taskId) || null;
}

/**
 * 更新任务进度
 * @param {string} taskId - 任务ID
 * @param {Object} result - 单个文件处理结果
 */
function updateTaskProgress(taskId, result) {
  const task = taskStore.get(taskId);
  if (task) {
    task.processed++;
    task.results.push(result);

    // 检查是否完成
    if (task.processed >= task.total) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
    }
  }
}

/**
 * 清理过期任务
 * @param {number} maxAge - 最大保留时间（毫秒）
 */
function cleanupExpiredTasks(maxAge = config.limits.exportExpiration) {
  const now = Date.now();
  for (const [taskId, task] of taskStore.entries()) {
    const createdAt = new Date(task.createdAt).getTime();
    if (now - createdAt > maxAge) {
      taskStore.delete(taskId);
    }
  }
}

/**
 * 生成任务ID
 * @returns {string}
 */
function generateTaskId() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `task_${timestamp}`;
}

/**
 * 获取文件类型
 * @param {string} filePath - 文件路径
 * @returns {string}
 */
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (['.jpg', '.jpeg', '.png'].includes(ext)) return 'image';
  return 'unknown';
}

/**
 * 验证文件
 * @param {string} filePath - 文件路径
 * @param {Object} fileInfo - 文件信息
 */
function validateFile(filePath, fileInfo) {
  if (!fileInfo) {
    throw new ApiError(404, 'DOC_FILE_NOT_FOUND', `文件不存在: ${filePath}`);
  }

  if (fileInfo.size > config.limits.maxFileSize) {
    throw new ApiError(413, 'DOC_FILE_TOO_LARGE', `文件大小超过限制: ${path.basename(filePath)}`, {
      fileName: path.basename(filePath),
      size: fileInfo.size,
      maxSize: config.limits.maxFileSize,
    });
  }

  const fileType = getFileType(filePath);
  if (fileType === 'unknown') {
    throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', `不支持的文件类型: ${path.basename(filePath)}`);
  }

  return fileType;
}

/**
 * 处理单个文件
 * @param {string} filePath - 文件路径
 * @param {Object} watermark - 水印参数
 * @param {Object} exportConfig - 导出配置
 * @param {string} fontPath - 字体文件路径
 * @returns {Promise<Object>}
 */
async function processFile(filePath, watermark, exportConfig, fontPath) {
  const fileType = getFileType(filePath);
  const fileName = path.basename(filePath);

  try {
    // 根据文件类型处理
    let outputBuffer;
    let outputExt = '.pdf';

    if (fileType === 'pdf') {
      outputBuffer = await pdfRenderer.addWatermarkToPdf(filePath, watermark, fontPath);
    } else {
      outputBuffer = await pdfRenderer.addWatermarkToImage(filePath, watermark, fontPath);
    }

    // 生成输出文件名
    const baseName = path.basename(filePath, path.extname(filePath));
    // 格式化时间戳：YYYYMMDDHHmmss（北京时间）
    const pad = (n) => n.toString().padStart(2, '0');
    const now = new Date();
    const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() + 8 * 60) * 60 * 1000);
    const timestamp = `${beijingTime.getFullYear()}${pad(beijingTime.getMonth() + 1)}${pad(beijingTime.getDate())}${pad(beijingTime.getHours())}${pad(beijingTime.getMinutes())}${pad(beijingTime.getSeconds())}`;
    let outputName;

    switch (exportConfig.namingRule) {
      case 'original':
        outputName = `${baseName}.pdf`;
        break;
      case 'timestamp':
        outputName = `${baseName}_${timestamp}.pdf`;
        break;
      case 'text':
        outputName = `${baseName}_${watermark.text || 'watermark'}.pdf`;
        break;
      case 'timestamp_text':
      default:
        outputName = `${baseName}_${timestamp}_${watermark.text || 'watermark'}.pdf`;
        break;
    }

    return {
      fileId: fileName,
      status: 'success',
      outputPath: null, // 稍后在打包时填充
      outputName,
      buffer: outputBuffer,
    };
  } catch (error) {
    return {
      fileId: fileName,
      status: 'failed',
      error: error.message || '处理失败',
    };
  }
}

/**
 * 批量处理文件
 * @param {Array<string>} filePaths - 文件路径列表
 * @param {Object} watermark - 水印参数
 * @param {Object} exportConfig - 导出配置
 * @returns {Promise<Object>}
 */
async function processBatch(filePaths, watermark, exportConfig) {
  // 验证文件数量
  if (filePaths.length > config.limits.maxFilesPerBatch) {
    throw new ApiError(400, 'TOO_MANY_FILES', `文件数量超过限制: ${filePaths.length}/${config.limits.maxFilesPerBatch}`);
  }

  // 生成任务ID
  const taskId = generateTaskId();

  // 创建任务
  const task = createTask(taskId, filePaths.length);

  // 创建导出目录
  const exportDir = path.join(config.dirs.exports, taskId);
  await ensureDir(exportDir);

  // 获取字体文件路径
  const fontName = watermark.font || '黑体';
  let fontPath = path.join(config.dirs.fonts, `${fontName.toLowerCase()}.ttf`);

  // 验证字体文件
  if (!(await exists(fontPath))) {
    // 尝试默认字体
    const defaultFontPath = path.join(config.dirs.fonts, 'simhei.ttf');
    if (await exists(defaultFontPath)) {
      fontPath = defaultFontPath;
    } else {
      throw new ApiError(400, 'FONT_NOT_FOUND', '找不到指定的字体文件');
    }
  }

  // 处理每个文件
  const results = [];
  for (const filePath of filePaths) {
    try {
      // 验证文件
      const fileInfo = await getFileInfo(filePath);
      validateFile(filePath, fileInfo);

      // 处理文件
      const result = await processFile(filePath, watermark, exportConfig, fontPath);

      if (result.status === 'success') {
        // 保存输出文件
        const outputPath = path.join(exportDir, result.outputName);
        await fs.writeFile(outputPath, result.buffer);
        result.outputPath = path.join(taskId, result.outputName);
        delete result.buffer; // 移除 buffer 以减小返回值
      }

      results.push(result);
      updateTaskProgress(taskId, result);
    } catch (error) {
      const result = {
        fileId: path.basename(filePath),
        status: 'failed',
        error: error.message || '处理失败',
      };
      results.push(result);
      updateTaskProgress(taskId, result);
    }
  }

  // 更新任务状态
  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.results = results;

  return {
    taskId,
    status: task.status,
    total: task.total,
    processed: task.processed,
    results: task.results.map((r) => ({
      fileId: r.fileId,
      status: r.status,
      outputPath: r.outputPath,
      error: r.error,
    })),
  };
}

/**
 * 创建 ZIP 包
 * @param {string} taskId - 任务ID
 * @param {Array<string>} filePaths - 文件路径列表
 * @returns {Promise<Buffer>}
 */
async function createZipPackage(taskId, filePaths) {
  const exportDir = path.join(config.dirs.exports, taskId);

  return new Promise((resolve, reject) => {
    const chunks = [];

    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    archive.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // 添加文件到 ZIP
    for (const filePath of filePaths) {
      archive.file(filePath, { name: path.basename(filePath) });
    }

    archive.finalize();
  });
}

/**
 * 打包任务结果为 ZIP
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>}
 */
async function packageResultsAsZip(taskId) {
  const task = getTask(taskId);
  if (!task) {
    throw new ApiError(404, 'TASK_NOT_FOUND', '任务不存在或已过期');
  }

  if (task.status !== 'completed') {
    throw new ApiError(400, 'TASK_NOT_COMPLETED', '任务尚未完成');
  }

  // 收集成功的结果文件
  const outputPaths = [];
  for (const result of task.results) {
    if (result.status === 'success' && result.outputPath) {
      const fullPath = path.join(config.dirs.exports, result.outputPath);
      if (await exists(fullPath)) {
        outputPaths.push(fullPath);
      }
    }
  }

  if (outputPaths.length === 0) {
    throw new ApiError(400, 'NO_RESULTS', '没有可打包的结果文件');
  }

  // 创建 ZIP
  const zipBuffer = await createZipPackage(taskId, outputPaths);

  return {
    buffer: zipBuffer,
    fileName: `${taskId}.zip`,
    fileCount: outputPaths.length,
  };
}

export default {
  processBatch,
  getTask,
  generateTaskId,
  createTask,
  updateTaskProgress,
  cleanupExpiredTasks,
  packageResultsAsZip,
  getFileType,
  validateFile,
};
