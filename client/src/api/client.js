/**
 * API 客户端
 * 处理所有与后端的 API 通信
 * 后端未就绪时使用 mock 数据
 */

import axios from 'axios';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
  withCredentials: true, // 允许携带 Cookie
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 添加 token（如果存在）
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const { response } = error;
    if (response?.status === 401) {
      // Token 无效或过期，清除本地存储并跳转登录
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============ Mock 数据 ============
const MOCK_MODE = false; // 设为 false 使用真实 API

const mockUsers = [
  { id: 'admin', username: 'admin', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'user1', username: 'user1', createdAt: '2026-04-01T00:00:00Z' },
];

const mockDocuments = {
  '/documents': {
    currentPath: '/documents',
    parentPath: null,
    items: [
      {
        id: 'doc_001',
        name: '证件照片1',
        path: '/documents/df2468113#20260313102119.jpg',
        type: 'jpg',
        size: 42630,
        isDirectory: false,
      },
      {
        id: 'doc_002',
        name: '证件照片2',
        path: '/documents/df2468113#20260317164608.jpg',
        type: 'jpg',
        size: 30518,
        isDirectory: false,
      },
      {
        id: 'doc_003',
        name: '测试图片',
        path: '/documents/image1.jpg',
        type: 'jpg',
        size: 956254,
        isDirectory: false,
      },
      {
        id: 'doc_004',
        name: 'PDF文档1',
        path: '/documents/pdf1.pdf',
        type: 'pdf',
        size: 149909,
        isDirectory: false,
      },
      {
        id: 'doc_005',
        name: 'PDF文档2',
        path: '/documents/padf2.pdf',
        type: 'pdf',
        size: 62587,
        isDirectory: false,
      },
      {
        id: 'doc_006',
        name: '空白A4文档',
        path: '/documents/blank_a4.pdf',
        type: 'pdf',
        size: 1024,
        isDirectory: false,
      },
      {
        id: 'doc_007',
        name: '空白图片',
        path: '/documents/blank_medium.png',
        type: 'png',
        size: 2048,
        isDirectory: false,
      },
    ],
  },
};

// 常用证件 - 初始布局（按照真实文件配置）
const mockLayout = {
  userId: 'admin',
  updatedAt: '2026-04-11T10:00:00Z',
  items: [
    { fileId: 'doc_001', fileName: '证件照片1', filePath: '/documents/df2468113#20260313102119.jpg', fileType: 'jpg', row: 0, order: 0 },
    { fileId: 'doc_002', fileName: '证件照片2', filePath: '/documents/df2468113#20260317164608.jpg', fileType: 'jpg', row: 0, order: 1 },
    { fileId: 'doc_003', fileName: '测试图片', filePath: '/documents/image1.jpg', fileType: 'jpg', row: 0, order: 2 },
    { fileId: 'doc_004', fileName: 'PDF文档1', filePath: '/documents/pdf1.pdf', fileType: 'pdf', row: 1, order: 0 },
    { fileId: 'doc_005', fileName: 'PDF文档2', filePath: '/documents/padf2.pdf', fileType: 'pdf', row: 1, order: 1 },
    { fileId: 'doc_006', fileName: '空白A4文档', filePath: '/documents/blank_a4.pdf', fileType: 'pdf', row: 1, order: 2 },
    { fileId: 'doc_007', fileName: '空白图片', filePath: '/documents/blank_medium.png', fileType: 'png', row: 2, order: 0 },
  ],
};

const mockSchemes = [
  {
    id: 'preset_001',
    name: '仅供内部使用',
    isPreset: true,
    createdAt: '2026-04-11T10:00:00Z',
    watermark: {
      text: '仅供内部使用',
      x: 0.5,
      y: 0.5,
      scale: 0.5,
      rotation: 0,
      opacity: 0.8,
      font: '微软雅黑',
      color: '#808080',
    },
  },
  {
    id: 'preset_002',
    name: '仅供XX业务使用',
    isPreset: true,
    createdAt: '2026-04-10T10:00:00Z',
    watermark: {
      text: '仅供XX业务使用',
      x: 0.5,
      y: 0.5,
      scale: 0.4,
      rotation: -30,
      opacity: 0.6,
      font: '黑体',
      color: '#606060',
    },
  },
  {
    id: 'scheme_001',
    name: '自定义方案1',
    isPreset: false,
    createdAt: '2026-04-09T10:00:00Z',
    watermark: {
      text: '测试水印',
      x: 0.3,
      y: 0.7,
      scale: 0.3,
      rotation: 45,
      opacity: 0.5,
      font: '楷体',
      color: '#FF0000',
    },
  },
];

const mockFonts = [
  { name: '微软雅黑', family: 'Microsoft YaHei', file: 'msyh.ttf', preview: '微软雅黑 Preview' },
  { name: '黑体', family: 'SimHei', file: 'simhei.ttf', preview: '黑体 Preview' },
  { name: '宋体', family: 'SimSun', file: 'simsun.ttf', preview: '宋体 Preview' },
  { name: '楷体', family: 'KaiTi', file: 'simkai.ttf', preview: '楷体 Preview' },
];

// Mock helper functions
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============ API 方法 ============

// 认证相关
export const authApi = {
  // 获取用户列表
  async getUsers() {
    if (MOCK_MODE) {
      await delay(300);
      return { success: true, data: mockUsers };
    }
    return apiClient.get('/auth/users');
  },

  // 创建新用户
  async createUser(username) {
    if (MOCK_MODE) {
      await delay(300);
      const newUser = { id: username, username, createdAt: new Date().toISOString() };
      mockUsers.push(newUser);
      return { success: true, data: newUser };
    }
    return apiClient.post('/auth/users', { username });
  },

  // 登录
  async login(username) {
    if (MOCK_MODE) {
      await delay(500);
      const user = mockUsers.find((u) => u.username === username) || { id: username, username, createdAt: new Date().toISOString() };
      const token = `mock_token_${user.id}_${Date.now()}`;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('current_user', JSON.stringify(user));
      return { success: true, data: { token, user } };
    }
    const response = await apiClient.post('/auth/login', { username });
    if (response.success && response.data?.token) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('current_user', JSON.stringify(response.data.user));
    }
    return response;
  },

  // 登出
  async logout() {
    if (MOCK_MODE) {
      await delay(200);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      return { success: true };
    }
    return apiClient.post('/auth/logout');
  },

  // 获取当前用户
  async getCurrentUser() {
    if (MOCK_MODE) {
      await delay(200);
      const userStr = localStorage.getItem('current_user');
      const token = localStorage.getItem('auth_token');
      if (userStr && token) {
        return { success: true, data: JSON.parse(userStr) };
      }
      return { success: false, error: { code: 'AUTH_TOKEN_INVALID', message: '未登录' } };
    }
    return apiClient.get('/auth/current');
  },
};

// 证件相关
export const documentsApi = {
  // 获取证件列表
  async getDocuments(path = '/documents', extensions = 'jpg,png,pdf') {
    if (MOCK_MODE) {
      await delay(400);
      const data = mockDocuments[path] || mockDocuments['/documents'];
      // 按名称过滤扩展名
      if (extensions) {
        const exts = extensions.split(',').map((e) => e.trim().toLowerCase());
        data.items = data.items.filter((item) => {
          if (item.isDirectory) return true;
          return exts.some((ext) => item.name.toLowerCase().endsWith(`.${ext}`));
        });
      }
      return { success: true, data };
    }
    return apiClient.get('/documents', { params: { path, extensions } });
  },

  // 获取常用证件列表
  async getFavorites() {
    if (MOCK_MODE) {
      await delay(200);
      // 从 mockDocuments 中获取文件的实际大小
      const items = mockLayout.items.map((item) => {
        const doc = mockDocuments['/documents'].items.find((d) => d.id === item.fileId);
        return {
          id: item.fileId,
          name: item.fileName,
          path: item.filePath,
          type: item.fileType,
          size: doc?.size || 0,
          isDirectory: false,
        };
      });
      return { success: true, data: items };
    }
    return apiClient.get('/documents/favorites');
  },

  // 获取单个证件内容（返回 base64 编码）
  async getDocumentContent(fileId) {
    if (MOCK_MODE) {
      await delay(300);
      // 找到文档
      const doc = mockDocuments['/documents'].items.find((d) => d.id === fileId);
      if (!doc) {
        return { success: false, error: { code: 'DOC_NOT_FOUND', message: '文档不存在' } };
      }
      // 返回文档信息和类型
      return {
        success: true,
        data: {
          id: doc.id,
          name: doc.name,
          type: doc.type,
          // 在 mock 模式下返回空，Canvas 需要真实文件
          dataUrl: null,
        },
      };
    }
    // 真实 API 返回 base64 编码的文件内容
    return apiClient.get(`/documents/${fileId}/content`);
  },

  // 添加到常用列表
  async addFavorites(fileIds, files) {
    if (MOCK_MODE) {
      await delay(200);
      return { success: true, data: { added: fileIds } };
    }
    return apiClient.post('/documents/favorites', { fileIds, files });
  },

  // 更新常用证件信息（如重命名）
  async updateFavorites(updates) {
    if (MOCK_MODE) {
      await delay(200);
      return { success: true, data: { updated: updates.length } };
    }
    return apiClient.put('/documents/favorites', { updates });
  },
};

// 背景文件相关
export const backgroundApi = {
  // 上传背景文件（本地文件需要先上传）
  async uploadBackground(fileData, fileName, mimeType) {
    if (MOCK_MODE) {
      await delay(500);
      return { success: true, data: { id: `bg_${Date.now()}`, name: fileName } };
    }
    // fileData 是 base64 编码的文件内容
    return apiClient.post('/background/upload', {
      file: {
        name: fileName,
        data: fileData,
        mimeType: mimeType,
      },
    });
  },
};

// 布局相关
export const layoutApi = {
  // 获取布局
  async getLayout() {
    if (MOCK_MODE) {
      await delay(200);
      return { success: true, data: mockLayout };
    }
    return apiClient.get('/layout');
  },

  // 保存布局
  async saveLayout(items) {
    if (MOCK_MODE) {
      await delay(300);
      mockLayout.items = items;
      mockLayout.updatedAt = new Date().toISOString();
      return { success: true, data: { updatedAt: mockLayout.updatedAt } };
    }
    return apiClient.put('/layout', { items });
  },
};

// 水印方案相关
export const schemesApi = {
  // 获取方案列表
  async getSchemes(type = 'all') {
    if (MOCK_MODE) {
      await delay(300);
      let data = [...mockSchemes];
      if (type === 'preset') data = data.filter((s) => s.isPreset);
      else if (type === 'common') data = data.filter((s) => !s.isPreset);
      return { success: true, data };
    }
    return apiClient.get('/watermark/schemes', { params: { type } });
  },

  // 获取方案详情
  async getScheme(id) {
    if (MOCK_MODE) {
      await delay(200);
      const scheme = mockSchemes.find((s) => s.id === id);
      if (scheme) return { success: true, data: scheme };
      return { success: false, error: { code: 'SCHEME_NOT_FOUND', message: '方案不存在' } };
    }
    return apiClient.get(`/watermark/schemes/${id}`);
  },

  // 创建方案
  async createScheme(data) {
    if (MOCK_MODE) {
      await delay(300);
      const newScheme = {
        id: `scheme_${Date.now()}`,
        ...data,
        createdAt: new Date().toISOString(),
      };
      mockSchemes.push(newScheme);
      return { success: true, data: newScheme };
    }
    return apiClient.post('/watermark/schemes', data);
  },

  // 更新方案
  async updateScheme(id, data) {
    if (MOCK_MODE) {
      await delay(300);
      const index = mockSchemes.findIndex((s) => s.id === id);
      if (index !== -1) {
        mockSchemes[index] = { ...mockSchemes[index], ...data, updatedAt: new Date().toISOString() };
        return { success: true, data: { id, updatedAt: mockSchemes[index].updatedAt } };
      }
      return { success: false, error: { code: 'SCHEME_NOT_FOUND', message: '方案不存在' } };
    }
    return apiClient.put(`/watermark/schemes/${id}`, data);
  },

  // 删除方案
  async deleteScheme(id) {
    if (MOCK_MODE) {
      await delay(200);
      const index = mockSchemes.findIndex((s) => s.id === id);
      if (index !== -1) {
        mockSchemes.splice(index, 1);
        return { success: true, data: { deleted: id } };
      }
      return { success: false, error: { code: 'SCHEME_NOT_FOUND', message: '方案不存在' } };
    }
    return apiClient.delete(`/watermark/schemes/${id}`);
  },

  // 导出方案
  async exportScheme(id, fileName) {
    if (MOCK_MODE) {
      await delay(200);
      const scheme = mockSchemes.find((s) => s.id === id);
      if (scheme) {
        const blob = new Blob([JSON.stringify(scheme, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `watermark_scheme_${scheme.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true };
      }
      return { success: false, error: { code: 'SCHEME_NOT_FOUND', message: '方案不存在' } };
    }
    return apiClient.post(`/watermark/schemes/export/${id}`, { fileName }, { responseType: 'blob' });
  },

  // 导入方案
  async importScheme(file) {
    if (MOCK_MODE) {
      await delay(300);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const scheme = JSON.parse(e.target.result);
            scheme.id = `scheme_${Date.now()}`;
            scheme.isPreset = false;
            mockSchemes.push(scheme);
            resolve({ success: true, data: scheme });
          } catch {
            resolve({ success: false, error: { code: 'INVALID_FILE', message: '无效的方案文件' } });
          }
        };
        reader.readAsText(file);
      });
    }
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/watermark/schemes/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// 字体相关
export const fontsApi = {
  // 获取字体列表
  async getFonts() {
    if (MOCK_MODE) {
      await delay(200);
      return { success: true, data: mockFonts };
    }
    return apiClient.get('/fonts');
  },
};

// 水印处理相关
export const processApi = {
  // 批量水印处理
  async processWatermark(data) {
    if (MOCK_MODE) {
      await delay(1000);
      return {
        success: true,
        data: {
          taskId: `task_${Date.now()}`,
          status: 'completed',
          total: data.fileIds.length,
          processed: data.fileIds.length,
          results: data.fileIds.map((fileId) => ({
            fileId,
            status: 'success',
            outputPath: `/exports/${fileId}.pdf`,
          })),
        },
      };
    }
    return apiClient.post('/process/watermark', data);
  },

  // 获取处理状态
  async getStatus(taskId) {
    if (MOCK_MODE) {
      await delay(500);
      return {
        success: true,
        data: {
          taskId,
          status: 'completed',
          total: 1,
          processed: 1,
          results: [{ fileId: 'doc_001', status: 'success', outputPath: '/exports/doc_001.pdf' }],
        },
      };
    }
    return apiClient.get(`/process/status/${taskId}`);
  },

  // 下载处理结果
  async downloadResult(taskId, format = 'zip') {
    if (MOCK_MODE) {
      await delay(500);
      // Mock 模式下创建空的测试文件
      const content = format === 'file'
        ? 'mock single file exported content'
        : 'mock zip exported content';
      const mimeType = format === 'file' ? 'application/pdf' : 'application/zip';
      const extension = format === 'file' ? 'pdf' : 'zip';
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watermarked_${taskId}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    }
    // 使用原始 axios 请求获取完整响应（包括 headers）
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/process/download/${taskId}?format=${format}`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`下载失败: ${response.statusText}`);
    }

    // 从 Content-Disposition 获取文件名
    const contentDisposition = response.headers.get('content-disposition') || '';
    let fileName = `watermarked_${taskId}.${format === 'file' ? 'pdf' : 'zip'}`;

    // 尝试解析 RFC 5987 格式 (filename*=UTF-8''encoded)
    const rfc5987Match = contentDisposition.match(/filename\*=(?:UTF-8''|)([^;\n]+)/i);
    if (rfc5987Match) {
      fileName = decodeURIComponent(rfc5987Match[1]);
    } else {
      // 回退到标准 filename 格式
      const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (fileNameMatch) {
        fileName = fileNameMatch[1].replace(/['"]/g, '');
      }
    }

    // 获取 blob 数据
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  },
};

// 设置相关
export const settingsApi = {
  // 获取设置
  async getSettings() {
    if (MOCK_MODE) {
      await delay(200);
      return {
        success: true,
        data: {
          userId: 'admin',
          export: { namingRule: 'timestamp_text', quality: 100 },
          defaultWatermark: { text: '', x: 0.5, y: 0.5, scale: 0.5, rotation: 0, opacity: 1, font: '微软雅黑', color: '#808080' },
        },
      };
    }
    return apiClient.get('/settings');
  },

  // 更新设置
  async updateSettings(data) {
    if (MOCK_MODE) {
      await delay(200);
      return { success: true, data: { updatedAt: new Date().toISOString() } };
    }
    return apiClient.put('/settings', data);
  },
};

export default apiClient;
