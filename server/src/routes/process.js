/**
 * 水印处理 API 路由
 * 处理批量水印处理、状态查询、结果下载等功能
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { successResponse, errorResponse, ApiError } from '../utils/response.js';
import { exists, ensureDir, getFileInfo, readJson } from '../utils/fileManager.js';
import watermarkEngine from '../services/watermarkEngine.js';

const router = express.Router();

// 文档根目录
const DOCS_ROOT = config.dirs.documents;

/**
 * 解析文件 ID 获取文件路径
 * @param {string} fileId - 文件 ID (可能是 "doc_xxx" 格式或文件路径)
 * @returns {Promise<string>}
 */
async function resolveFileId(fileId) {
  // fileId 可能是文件路径或 ID
  // 先尝试作为路径处理
  const filePath = path.join(DOCS_ROOT, fileId);
  // 防止路径遍历攻击：验证解析后的路径在 DOCS_ROOT 内
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(DOCS_ROOT))) {
    throw new ApiError(400, 'INVALID_FILE_PATH', '无效的文件路径');
  }
  if (await exists(filePath)) {
    return filePath;
  }

  // 如果是 ID 格式 (doc_xxx)，需要在文档目录中搜索匹配的文件
  if (fileId.startsWith('doc_')) {
    const files = await scanDocumentsDir(DOCS_ROOT);
    // 直接在文件列表中查找 ID 匹配的文件
    // 由于 documents API 返回的 id 是基于文件路径的 hash，我们需要找到对应文件
    for (const file of files) {
      const fullPath = path.join(DOCS_ROOT, file);
      const id = generateFileId(fullPath);
      if (id === fileId) {
        return fullPath;
      }
    }
  }

  // 如果是 ID，需要在文档目录中搜索
  // 简化处理：fileId 应该包含完整路径信息
  throw new ApiError(404, 'DOC_FILE_NOT_FOUND', `文件不存在: ${fileId}`);
}

/**
 * 生成文件的唯一 ID（与 documents.js 保持一致）
 * @param {string} filePath - 文件的完整路径
 * @returns {string}
 */
function generateFileId(filePath) {
  // 使用相对路径的哈希作为 ID（与 documents.js 一致）
  const relativePath = path.relative(DOCS_ROOT, filePath);
  const hash = relativePath.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return `doc_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * 递归扫描文档目录，返回所有文件路径（相对于 DOCS_ROOT）
 * @param {string} dir - 目录路径
 * @param {string} basePath - 基础路径（用于构建相对路径）
 * @returns {Promise<string[]>}
 */
async function scanDocumentsDir(dir, basePath = '') {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        const subFiles = await scanDocumentsDir(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
  } catch (err) {
    // 目录不存在或无法读取，返回空数组
  }
  return files;
}

/**
 * 根据方案ID读取水印方案
 * @param {string} userId - 用户ID
 * @param {string} schemeId - 方案ID
 * @returns {Promise<Object>}
 */
async function getWatermarkScheme(userId, schemeId) {
  // 如果是 'default' 或空，使用用户的默认水印配置
  if (schemeId === 'default' || !schemeId) {
    const settingsPath = path.join(config.dirs.users, userId, 'settings.json');
    console.log('[process/watermark] 读取设置文件路径:', settingsPath);
    const userSettings = await readJson(settingsPath);
    console.log('[process/watermark] 用户设置内容:', userSettings);

    if (userSettings?.defaultWatermark) {
      console.log('[process/watermark] 使用用户默认水印配置:', userSettings.defaultWatermark);
      return userSettings.defaultWatermark;
    }
    // 如果连 defaultWatermark 都没有，返回内置默认值
    console.log('[process/watermark] 使用内置默认值（水印文字为空）');
    return {
      text: '',
      x: 0.5,
      y: 0.5,
      scale: 0.05,
      rotation: 0,
      opacity: 0.8,
      font: '黑体',
      color: '#808080',
    };
  }

  const schemePath = path.join(config.dirs.users, userId, 'schemes', `${schemeId}.json`);
  const schemeData = await readJson(schemePath);

  if (!schemeData) {
    throw new ApiError(404, 'SCHEME_NOT_FOUND', '方案不存在');
  }

  return schemeData.watermark;
}

/**
 * POST /api/process/watermark
 * 批量水印处理
 *
 * 请求参数：
 * - schemeId: 水印方案ID（必填）
 * - text: 水印文本（可选，会覆盖方案中的文本）
 * - fileIds: 要处理的文件ID列表（必填）
 * - exportConfig: 导出配置（可选）
 */
router.post('/watermark', authMiddleware, async (req, res) => {
  try {
    const { schemeId, watermark, text, fileIds, exportConfig } = req.body;

    // 详细日志：打印接收到的参数
    console.log('[process/watermark] 接收到的参数:', JSON.stringify({
      schemeId,
      watermark,
      text,
      fileIds,
      exportConfig,
    }, null, 2));

    // 验证必填参数
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'fileIds 必须是非空数组');
    }

    // 验证文件数量限制
    if (fileIds.length > config.limits.maxFilesPerBatch) {
      throw new ApiError(400, 'TOO_MANY_FILES', `文件数量超过限制: ${fileIds.length}/${config.limits.maxFilesPerBatch}`);
    }

    // 获取水印参数：优先使用直接传递的水印配置，否则使用方案
    let mergedWatermark;
    const userId = req.user.id;

    if (watermark && typeof watermark === 'object') {
      // 直接传递水印参数
      console.log('[process/watermark] 使用直接传递的水印参数');
      const watermarkText = (text && text.trim()) ? text.trim() : (watermark.text || '');
      if (!watermarkText) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印文字不能为空');
      }
      mergedWatermark = {
        x: watermark.x ?? 0.5,
        y: watermark.y ?? 0.5,
        scale: watermark.scale ?? 0.05,
        rotation: watermark.rotation ?? 0,
        opacity: watermark.opacity ?? 0.8,
        font: watermark.font || '黑体',
        color: watermark.color || '#808080',
        text: watermarkText,
      };
    } else if (schemeId && typeof schemeId === 'string') {
      // 使用方案
      console.log('[process/watermark] 使用方案 ID:', schemeId);
      const schemeWatermark = await getWatermarkScheme(userId, schemeId);

      // 使用传入的 text 覆盖方案的文本（如果有）
      const watermarkText = (text && text.trim()) ? text.trim() : schemeWatermark.text;

      if (!watermarkText) {
        throw new ApiError(400, 'VALIDATION_ERROR', '水印文字不能为空');
      }

      mergedWatermark = {
        x: schemeWatermark.x ?? 0.5,
        y: schemeWatermark.y ?? 0.5,
        scale: schemeWatermark.scale ?? 0.05,
        rotation: schemeWatermark.rotation ?? 0,
        opacity: schemeWatermark.opacity ?? 1,
        font: schemeWatermark.font ?? '黑体',
        color: schemeWatermark.color ?? '#808080',
        text: watermarkText,
      };
    } else {
      throw new ApiError(400, 'VALIDATION_ERROR', '必须提供 schemeId 或 watermark 参数');
    }

    console.log('[process/watermark] 最终水印参数:', JSON.stringify(mergedWatermark, null, 2));

    // 解析文件路径
    const filePaths = [];
    for (const fileId of fileIds) {
      const filePath = await resolveFileId(fileId);
      filePaths.push(filePath);
    }

    // 合并导出配置
    const mergedExportConfig = {
      namingRule: exportConfig?.namingRule || 'timestamp_text',
      quality: exportConfig?.quality || 100,
    };

    // 启动批量处理
    const result = await watermarkEngine.processBatch(filePaths, mergedWatermark, mergedExportConfig);

    res.status(202).json(
      successResponse({
        taskId: result.taskId,
        status: result.status,
        total: result.total,
        processed: result.processed,
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
          ...(error.details && { details: error.details }),
        },
      });
    }
    console.error('Watermark process error:', error);
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
 * GET /api/process/status/:taskId
 * 查询处理状态
 */
router.get('/status/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = watermarkEngine.getTask(taskId);

    if (!task) {
      throw new ApiError(404, 'TASK_NOT_FOUND', '任务不存在或已过期');
    }

    res.json(
      successResponse({
        taskId: task.taskId,
        status: task.status,
        total: task.total,
        processed: task.processed,
        results: task.results,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
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
    console.error('Get status error:', error);
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
 * GET /api/process/download/:taskId
 * 下载处理结果
 */
router.get('/download/:taskId', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { format } = req.query; // 'zip' 或 'single'

    const task = watermarkEngine.getTask(taskId);

    if (!task) {
      throw new ApiError(404, 'TASK_NOT_FOUND', '任务不存在或已过期');
    }

    if (task.status !== 'completed') {
      throw new ApiError(400, 'TASK_NOT_COMPLETED', '任务尚未完成');
    }

    // 获取成功的结果文件
    const successResults = task.results.filter((r) => r.status === 'success');

    if (successResults.length === 0) {
      throw new ApiError(400, 'NO_RESULTS', '没有可下载的结果文件');
    }

    console.log('[下载逻辑] 参数信息:', {
      taskId,
      format,
      successCount: successResults.length,
      files: successResults.map(r => r.outputPath)
    });

    // 判断下载方式：
    // 1. 如果 format === 'file' 或只有单个成功文件，直接下载 PDF
    // 2. 如果有多个文件且 format !== 'file'，打包下载 ZIP
    const shouldDownloadSingle = format === 'file' || successResults.length === 1;

    if (shouldDownloadSingle) {
      const result = successResults[0];
      const filePath = path.join(config.dirs.exports, result.outputPath);

      console.log('[下载逻辑] 单文件下载:', {
        outputPath: result.outputPath,
        fullPath: filePath
      });

      if (!(await exists(filePath))) {
        console.error('[下载逻辑] 文件不存在:', filePath);
        throw new ApiError(404, 'FILE_NOT_FOUND', '结果文件不存在');
      }

      // 验证文件可读性
      try {
        await fs.access(filePath, fs.constants.R_OK);
        console.log('[下载逻辑] 文件可读，准备下载');
      } catch (err) {
        console.error('[下载逻辑] 文件不可读:', filePath, err);
        throw new ApiError(500, 'FILE_READ_ERROR', '结果文件无法读取');
      }

      res.download(filePath, result.outputPath.split('/').pop(), (err) => {
        if (err) {
          console.error('[下载逻辑] 下载失败:', err);
        } else {
          console.log('[下载逻辑] 下载成功:', result.outputPath);
        }
      });
      return;
    }

    // 多文件打包下载
    console.log('[下载逻辑] 多文件打包下载，文件数量:', successResults.length);
    const { buffer, fileName } = await watermarkEngine.packageResultsAsZip(taskId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
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
    console.error('Download error:', error);
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
 * DELETE /api/process/cleanup
 * 清理临时文件
 */
router.delete('/cleanup', authMiddleware, async (req, res) => {
  try {
    const cleanup = await import('../utils/cleanup.js');
    const result = await cleanup.default.cleanupExports();

    res.json(
      successResponse({
        cleaned: result.cleaned,
        freedSpace: result.freedSpace,
      })
    );
  } catch (error) {
    console.error('Cleanup error:', error);
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
