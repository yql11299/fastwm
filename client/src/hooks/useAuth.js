import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import useAppStore from '../stores/appStore';

/**
 * 认证状态 Hook
 * 管理用户登录/登出状态和自动登录逻辑
 */
export function useAuth() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 检查是否已登录（自动登录）
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await authApi.getCurrentUser();
        if (response.success && response.data) {
          setCurrentUser(response.data);
        } else {
          // Token 无效，清除
          localStorage.removeItem('auth_token');
          localStorage.removeItem('current_user');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [setCurrentUser]);

  // 登录
  const login = useCallback(
    async (username) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await authApi.login(username);
        if (response.success && response.data?.user) {
          // 保存 token 和用户信息到 localStorage
          localStorage.setItem('auth_token', response.data.token);
          localStorage.setItem('current_user', JSON.stringify(response.data.user));
          setCurrentUser(response.data.user);
          navigate('/');
          return { success: true };
        } else {
          throw new Error(response.error?.message || '登录失败');
        }
      } catch (err) {
        const errorMessage = err.message || '登录失败，请重试';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, setCurrentUser]
  );

  // 登出
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // 先清除 localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      // 清除 currentUser 会触发 App 组件重新渲染
      // 此时 isAuthenticated 变为 false，路由会自动渲染 Login 组件
      setCurrentUser(null);
    }
  }, [setCurrentUser]);

  // 获取用户列表
  const getUsers = useCallback(async () => {
    try {
      const response = await authApi.getUsers();
      if (response.success) {
        return { success: true, data: response.data };
      }
      throw new Error(response.error?.message || '获取用户列表失败');
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // 创建新用户
  const createUser = useCallback(async (username) => {
    try {
      const response = await authApi.createUser(username);
      if (response.success) {
        return { success: true, data: response.data };
      }
      throw new Error(response.error?.message || '创建用户失败');
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  return {
    currentUser,
    isAuthenticated: !!currentUser,
    isLoading,
    error,
    login,
    logout,
    getUsers,
    createUser,
  };
}
