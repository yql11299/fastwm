import { create } from 'zustand';

/**
 * 全局应用状态管理
 */
const useAppStore = create((set, get) => ({
  // ============ 用户状态 ============
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // ============ 证件列表状态 ============
  documents: [],
  selectedDocuments: [],
  favorites: [],
  setDocuments: (docs) => set({ documents: docs }),
  setSelectedDocuments: (ids) => set({ selectedDocuments: ids }),
  toggleDocumentSelection: (id) => {
    const { selectedDocuments } = get();
    if (selectedDocuments.includes(id)) {
      set({ selectedDocuments: selectedDocuments.filter((docId) => docId !== id) });
    } else {
      set({ selectedDocuments: [...selectedDocuments, id] });
    }
  },
  selectAllDocuments: () => {
    const { favorites } = get();
    set({ selectedDocuments: favorites.filter((d) => !d.isDirectory).map((d) => d.id) });
  },
  clearSelection: () => set({ selectedDocuments: [] }),
  setFavorites: (favs) => set({ favorites: favs }),

  // ============ 布局状态 ============
  layoutItems: [],
  setLayoutItems: (items) => set({ layoutItems: items }),
  updateLayoutItem: (fileId, updates) => {
    const { layoutItems } = get();
    set({
      layoutItems: layoutItems.map((item) =>
        item.fileId === fileId ? { ...item, ...updates } : item
      ),
    });
  },
  addLayoutItem: (item) => set({ layoutItems: [...get().layoutItems, item] }),
  removeLayoutItem: (fileId) => {
    set({ layoutItems: get().layoutItems.filter((item) => item.fileId !== fileId) });
  },
  moveLayoutItem: (fileId, newRow, newOrder) => {
    const { layoutItems } = get();
    // 更新移动的项
    const updatedItems = layoutItems.map((item) =>
      item.fileId === fileId ? { ...item, row: newRow, order: newOrder } : item
    );
    // 清理空行
    set({ layoutItems: cleanEmptyRows(updatedItems) });
  },

  // ============ 水印状态 ============
  // 注意：默认值必须与后端 process.js 中 getWatermarkScheme 的默认值保持一致
  watermark: {
    text: '',
    x: 0.5,
    y: 0.5,
    scale: 0.05,
    rotation: 0,
    opacity: 0.8,
    font: '黑体',
    color: '#808080',
  },
  setWatermark: (updates) => set({ watermark: { ...get().watermark, ...updates } }),
  // 水印实际渲染尺寸（基于 pathData 计算）
  watermarkSize: { width: 0, height: 0 },
  setWatermarkSize: (size) => set({ watermarkSize: size }),
  resetWatermark: () =>
    set({
      watermark: {
        text: '',
        x: 0.5,
        y: 0.5,
        scale: 0.05,
        rotation: 0,
        opacity: 0.8,
        font: '黑体',
        color: '#808080',
      },
    }),

  // ============ 画布状态 ============
  canvasBackground: null,
  setCanvasBackground: (bg) => set({ canvasBackground: bg }),
  canvasSize: { width: 800, height: 600 },
  setCanvasSize: (size) => set({ canvasSize: size }),

  // ============ 方案状态 ============
  schemes: [],
  currentScheme: null,
  setSchemes: (schemes) => set({ schemes }),
  setCurrentScheme: (scheme) => set({ currentScheme: scheme }),

  // ============ 字体状态 ============
  fonts: [],
  setFonts: (fonts) => set({ fonts }),

  // ============ 设置状态 ============
  settings: {
    export: { namingRule: 'timestamp_text', quality: 100 },
    defaultWatermark: { text: '水印', x: 0.5, y: 0.5, scale: 0.5, rotation: 0, opacity: 1.0, font: '微软雅黑', color: '#000000' },
  },
  setSettings: (settings) => set({ settings }),

  // ============ UI 状态 ============
  isEditMode: false,
  setEditMode: (mode) => set({ isEditMode: mode }),
  isProcessing: false,
  setProcessing: (status) => set({ isProcessing: status }),
}));

/**
 * 清理布局中的空行
 */
function cleanEmptyRows(items) {
  // 获取所有有文件的行
  const rowsWithItems = new Set(items.map((item) => item.row));
  // 如果某行没有文件，就移除该行
  // 但是我们需要保持行号连续
  const nonEmptyItems = items.filter((item) => rowsWithItems.has(item.row));

  // 重新计算行号
  const rowMap = {};
  let currentRow = 0;
  nonEmptyItems.forEach((item) => {
    if (rowMap[item.row] === undefined) {
      rowMap[item.row] = currentRow++;
    }
    item.row = rowMap[item.row];
  });

  // 按行和顺序排序
  return nonEmptyItems.sort((a, b) => a.row - b.row || a.order - b.order);
}

export default useAppStore;
