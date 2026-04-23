import { useState, useCallback } from 'react';
import { schemesApi } from '../api/client';
import useAppStore from '../stores/appStore';

/**
 * 方案管理 Hook
 * 处理方案的 CRUD 操作和导入/导出
 */
export function useSchemes() {
  const { schemes, setSchemes, currentScheme, setCurrentScheme } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // 加载方案列表
  const loadSchemes = useCallback(async (type = 'all') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await schemesApi.getSchemes(type);
      if (response.success && response.data) {
        setSchemes(response.data);
        return { success: true, data: response.data };
      }
      throw new Error(response.error?.message || '加载方案失败');
    } catch (err) {
      const errorMessage = err.message || '加载方案失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [setSchemes]);

  // 获取方案详情
  const getScheme = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await schemesApi.getScheme(id);
      if (response.success && response.data) {
        setCurrentScheme(response.data);
        return { success: true, data: response.data };
      }
      throw new Error(response.error?.message || '获取方案失败');
    } catch (err) {
      const errorMessage = err.message || '获取方案失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [setCurrentScheme]);

  // 创建方案
  const createScheme = useCallback(async (data) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await schemesApi.createScheme(data);
      if (response.success && response.data) {
        setSchemes([...(schemes || []), response.data]);
        return { success: true, data: response.data };
      }
      throw new Error(response.error?.message || '创建方案失败');
    } catch (err) {
      const errorMessage = err.message || '创建方案失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [schemes, setSchemes]);

  // 更新方案
  const updateScheme = useCallback(async (id, data) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await schemesApi.updateScheme(id, data);
      if (response.success) {
        // 更新本地列表
        if (schemes) {
          setSchemes(
            schemes.map((s) =>
              s.id === id ? { ...s, ...data, updatedAt: response.data?.updatedAt } : s
            )
          );
        }
        // 更新当前方案
        if (currentScheme?.id === id) {
          setCurrentScheme({ ...currentScheme, ...data });
        }
        return { success: true };
      }
      throw new Error(response.error?.message || '更新方案失败');
    } catch (err) {
      const errorMessage = err.message || '更新方案失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [schemes, currentScheme, setSchemes, setCurrentScheme]);

  // 删除方案
  const deleteScheme = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await schemesApi.deleteScheme(id);
      if (response.success) {
        // 从本地列表移除
        if (schemes) {
          setSchemes(schemes.filter((s) => s.id !== id));
        }
        // 清除当前方案
        if (currentScheme?.id === id) {
          setCurrentScheme(null);
        }
        return { success: true };
      }
      throw new Error(response.error?.message || '删除方案失败');
    } catch (err) {
      const errorMessage = err.message || '删除方案失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [schemes, currentScheme, setSchemes, setCurrentScheme]);

  // 导出方案
  const exportScheme = useCallback(async (id) => {
    setError(null);
    try {
      const response = await schemesApi.exportScheme(id);
      if (response.success) {
        return { success: true };
      }
      throw new Error('导出失败');
    } catch (err) {
      const errorMessage = err.message || '导出失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // 导入方案
  const importScheme = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await schemesApi.importScheme(file);
      if (response.success && response.data) {
        setSchemes([...(schemes || []), response.data]);
        return { success: true, data: response.data };
      }
      throw new Error(response.error?.message || '导入失败');
    } catch (err) {
      const errorMessage = err.message || '导入失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [schemes, setSchemes]);

  // 设为预设
  const setAsPreset = useCallback(async (id) => {
    return updateScheme(id, { isPreset: true });
  }, [updateScheme]);

  // 取消预设
  const removePreset = useCallback(async (id) => {
    return updateScheme(id, { isPreset: false });
  }, [updateScheme]);

  // 获取预设方案
  const getPresetSchemes = useCallback(() => {
    return (schemes || []).filter((s) => s.isPreset);
  }, [schemes]);

  // 获取普通方案
  const getCommonSchemes = useCallback(() => {
    return (schemes || []).filter((s) => !s.isPreset);
  }, [schemes]);

  return {
    // 状态
    schemes,
    currentScheme,
    isLoading,
    error,

    // 方法
    loadSchemes,
    getScheme,
    createScheme,
    updateScheme,
    deleteScheme,
    exportScheme,
    importScheme,
    setAsPreset,
    removePreset,
    getPresetSchemes,
    getCommonSchemes,

    // 清理错误
    clearError: () => setError(null),
  };
}
