import { useState, useCallback } from 'react';
import { layoutApi } from '../api/client';
import useAppStore from '../stores/appStore';

/**
 * 布局管理 Hook
 * 处理布局的加载、保存、导出、导入
 */
export function useLayout() {
  const { layoutItems, setLayoutItems, addLayoutItem, removeLayoutItem, moveLayoutItem } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // 加载布局
  const loadLayout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await layoutApi.getLayout();
      if (response.success && response.data?.items) {
        setLayoutItems(response.data.items);
        return { success: true, data: response.data.items };
      }
      throw new Error(response.error?.message || '加载布局失败');
    } catch (err) {
      const errorMessage = err.message || '加载布局失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [setLayoutItems]);

  // 保存布局
  const saveLayout = useCallback(async (items) => {
    setIsLoading(true);
    setError(null);
    try {
      // 清理空行
      const cleanedItems = cleanEmptyRows(items);
      const response = await layoutApi.saveLayout(cleanedItems);
      if (response.success) {
        setLayoutItems(cleanedItems);
        return { success: true };
      }
      throw new Error(response.error?.message || '保存布局失败');
    } catch (err) {
      const errorMessage = err.message || '保存布局失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [setLayoutItems]);

  // 添加文件到布局
  const addToLayout = useCallback(
    async (document) => {
      // 计算新项目的位置
      const maxRow = layoutItems.length > 0 ? Math.max(...layoutItems.map((i) => i.row)) : 0;
      const itemsInLastRow = layoutItems.filter((i) => i.row === maxRow);
      const newOrder = itemsInLastRow.length;
      const newRow = itemsInLastRow.length >= 4 ? maxRow + 1 : maxRow;

      const newItem = {
        fileId: document.id,
        fileName: document.name,
        filePath: document.path,
        fileType: document.type,
        row: newRow,
        order: newOrder,
      };

      addLayoutItem(newItem);

      // 保存到服务器
      const result = await saveLayout([...layoutItems, newItem]);
      return result;
    },
    [layoutItems, addLayoutItem, saveLayout]
  );

  // 从布局移除文件
  const removeFromLayout = useCallback(
    async (fileId) => {
      const newItems = layoutItems.filter((item) => item.fileId !== fileId);
      // 重新整理顺序
      const reorganizedItems = reorganizeItems(newItems);

      removeLayoutItem(fileId);

      // 保存到服务器
      const result = await saveLayout(reorganizedItems);
      return result;
    },
    [layoutItems, removeLayoutItem, saveLayout]
  );

  // 移动布局中的项目
  const moveInLayout = useCallback(
    async (fileId, targetIndex) => {
      // 计算目标行和顺序
      const targetRow = Math.floor(targetIndex / 4);
      const targetOrder = targetIndex % 4;

      // 获取被移动的项
      const itemToMove = layoutItems.find((i) => i.fileId === fileId);
      if (!itemToMove) return { success: false, error: '项目不存在' };

      // 从原位置移除
      const otherItems = layoutItems.filter((i) => i.fileId !== fileId);

      // 插入到目标位置
      let newItems;
      if (targetOrder >= otherItems.filter((i) => i.row === targetRow).length) {
        // 添加到最后
        newItems = [
          ...otherItems,
          { ...itemToMove, row: targetRow, order: otherItems.filter((i) => i.row === targetRow).length },
        ];
      } else {
        // 插入到中间
        const itemsInTargetRow = otherItems
          .filter((i) => i.row === targetRow)
          .sort((a, b) => a.order - b.order);
        const itemsBeforeTarget = otherItems.filter((i) => i.row < targetRow);

        newItems = [
          ...itemsBeforeTarget,
          ...itemsInTargetRow.slice(0, targetOrder),
          { ...itemToMove, row: targetRow, order: targetOrder },
          ...itemsInTargetRow.slice(targetOrder),
          ...otherItems.filter((i) => i.row > targetRow),
        ];
      }

      // 重新整理
      const reorganizedItems = reorganizeItems(newItems);
      moveLayoutItem(fileId, targetRow, targetOrder);

      // 保存到服务器
      const result = await saveLayout(reorganizedItems);
      return result;
    },
    [layoutItems, moveLayoutItem, saveLayout]
  );

  // 导出布局
  const exportLayout = useCallback(async () => {
    try {
      const response = await layoutApi.exportLayout?.();
      if (response?.success) {
        return { success: true };
      }
      // 如果没有 exportLayout 方法，手动下载
      const blob = new Blob([JSON.stringify({ items: layoutItems }, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `layout_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [layoutItems]);

  // 导入布局
  const importLayout = useCallback(
    async (file) => {
      try {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const data = JSON.parse(e.target.result);
              if (data.items && Array.isArray(data.items)) {
                const result = await saveLayout(data.items);
                resolve(result);
              } else {
                resolve({ success: false, error: '无效的布局文件' });
              }
            } catch {
              resolve({ success: false, error: '解析布局文件失败' });
            }
          };
          reader.readAsText(file);
        });
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [saveLayout]
  );

  return {
    layoutItems,
    isLoading,
    error,
    loadLayout,
    saveLayout,
    addToLayout,
    removeFromLayout,
    moveInLayout,
    exportLayout,
    importLayout,
  };
}

/**
 * 清理布局中的空行
 */
function cleanEmptyRows(items) {
  if (!items || items.length === 0) return [];

  // 获取有文件的行
  const rowsWithItems = new Set(items.map((item) => item.row));

  // 重新计算行号，使行号连续
  const rowMap = {};
  let currentRow = 0;
  [...rowsWithItems].sort((a, b) => a - b).forEach((oldRow) => {
    rowMap[oldRow] = currentRow++;
  });

  // 更新所有项目并清理空行
  return items
    .map((item) => ({
      ...item,
      row: rowMap[item.row] !== undefined ? rowMap[item.row] : 0,
    }))
    .sort((a, b) => a.row - b.row || a.order - b.order);
}

/**
 * 重新整理项目顺序
 */
function reorganizeItems(items) {
  if (!items || items.length === 0) return [];

  // 按行分组
  const rowGroups = {};
  items.forEach((item) => {
    const row = item.row || 0;
    if (!rowGroups[row]) {
      rowGroups[row] = [];
    }
    rowGroups[row].push(item);
  });

  // 重新编号
  const result = [];
  Object.keys(rowGroups)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((row) => {
      rowGroups[row].sort((a, b) => a.order - b.order).forEach((item, index) => {
        result.push({
          ...item,
          row: Number(row),
          order: index,
        });
      });
    });

  return result;
}
