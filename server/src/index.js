/**
 * 证件水印处理系统 - 后端服务入口
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/index.js';
import { ensureDir } from './utils/fileManager.js';
import cleanup from './utils/cleanup.js';

const { startPeriodicCleanup } = cleanup;

// 路由
import authRoutes from './routes/auth.js';
import documentsRoutes from './routes/documents.js';
import processRoutes from './routes/process.js';
import fontsRoutes from './routes/fonts.js';
import layoutRoutes from './routes/layout.js';
import watermarkRoutes from './routes/watermark.js';
import settingsRoutes from './routes/settings.js';
import backgroundRoutes from './routes/background.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 Express 应用
const app = express();

// 中间件
app.use(helmet({
  contentSecurityPolicy: false, // 关闭 CSP，方便前端调试
}));

app.use(cors({
  origin: true, // 允许所有来源，便于开发
  credentials: true, // 允许 Cookie
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/process', processRoutes);
app.use('/api/fonts', fontsRoutes);
app.use('/api/layout', layoutRoutes);
app.use('/api/watermark', watermarkRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/background', backgroundRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: '证件水印处理系统 - 后端服务',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      documents: '/api/documents',
      process: '/api/process',
      fonts: '/api/fonts',
      layout: '/api/layout',
      watermark: '/api/watermark',
      settings: '/api/settings',
      health: '/health',
    },
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: `路由不存在: ${req.method} ${req.path}`,
    },
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  res.status(err.statusCode || 500).json({
    success: false,
    data: null,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || '服务器内部错误',
      ...(err.details && { details: err.details }),
    },
  });
});

// 初始化服务器
async function initializeServer() {
  try {
    // 确保必要目录存在
    console.log('初始化目录...');
    await ensureDir(config.dirs.users);
    await ensureDir(config.dirs.documents);
    await ensureDir(config.dirs.exports);
    await ensureDir(config.dirs.fonts);
    console.log('目录初始化完成');

    // 启动清理任务（每 24 小时执行一次）
    startPeriodicCleanup(24);

    // 启动服务器
    const port = config.port;
    const host = process.env.HOST || '0.0.0.0';
    app.listen(port, host, () => {
      console.log(`证件水印处理系统服务已启动，端口: ${port}，地址: http://${host}:${port}`);
      console.log(`环境: ${config.nodeEnv}`);
      console.log(`字体目录: ${config.dirs.fonts}`);
      console.log(`用户目录: ${config.dirs.users}`);
      console.log(`文档目录: ${config.dirs.documents}`);
      console.log(`导出目录: ${config.dirs.exports}`);
    });
  } catch (error) {
    console.error('服务器初始化失败:', error);
    process.exit(1);
  }
}

// 启动服务器
initializeServer();

export default app;
