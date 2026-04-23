import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Login from '../components/auth/Login';

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    getUsers: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { id: 'admin', username: 'admin', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'user1', username: 'user1', createdAt: '2026-04-01T00:00:00Z' },
      ],
    }),
    createUser: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
};

describe('Login Component', () => {
  it('renders login page with title', () => {
    renderLogin();
    expect(screen.getByText('证件水印处理系统')).toBeInTheDocument();
    expect(screen.getByText('请选择用户登录')).toBeInTheDocument();
  });

  it('displays user list', async () => {
    renderLogin();

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('user1')).toBeInTheDocument();
    });
  });

  it('allows selecting a user', async () => {
    renderLogin();

    await waitFor(() => {
      const adminButton = screen.getByText('admin').closest('button');
      fireEvent.click(adminButton);
    });

    const loginButton = screen.getByRole('button', { name: /登录/ });
    expect(loginButton).not.toBeDisabled();
  });

  it('shows create user form when clicking create button', async () => {
    renderLogin();

    const createButton = screen.getByRole('button', { name: /新建用户/ });
    fireEvent.click(createButton);

    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /创建/ })).toBeInTheDocument();
  });

  it('validates empty username on login', async () => {
    renderLogin();

    const loginButton = screen.getByRole('button', { name: /登录/ });
    expect(loginButton).toBeDisabled();
  });

  it('shows error message when provided', async () => {
    // Re-mock with error
    vi.resetModules();
    vi.mock('../hooks/useAuth', () => ({
      useAuth: () => ({
        login: vi.fn(),
        getUsers: vi.fn().mockResolvedValue({ success: true, data: [] }),
        createUser: vi.fn(),
        isLoading: false,
        error: '登录失败',
      }),
    }));

    renderLogin();

    await waitFor(() => {
      expect(screen.getByText('登录失败')).toBeInTheDocument();
    });
  });
});
