import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import styles from './Login.module.css';

/**
 * 登录页面组件
 * 显示用户列表，支持选择用户或新建用户
 */
export default function Login() {
  const { login, getUsers, createUser, isLoading, error } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [localError, setLocalError] = useState('');

  // 加载用户列表
  useEffect(() => {
    const loadUsers = async () => {
      const result = await getUsers();
      if (result.success) {
        setUsers(result.data || []);
      }
    };
    loadUsers();
  }, [getUsers]);

  // 处理登录
  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError('');

    const username = selectedUser || newUsername.trim();
    if (!username) {
      setLocalError('请选择或输入用户名');
      return;
    }

    await login(username);
  };

  // 处理创建用户
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLocalError('');

    const username = newUsername.trim();
    if (!username) {
      setLocalError('请输入用户名');
      return;
    }

    if (username.length < 2) {
      setLocalError('用户名至少需要2个字符');
      return;
    }

    const result = await createUser(username);
    if (result.success) {
      setSelectedUser(username);
      setIsCreating(false);
      setNewUsername('');
    } else {
      setLocalError(result.error || '创建用户失败');
    }
  };

  // 选择用户
  const handleSelectUser = (userId) => {
    setSelectedUser(userId);
    setIsCreating(false);
    setLocalError('');
  };

  // 切换到创建用户模式
  const handleSwitchToCreate = () => {
    setIsCreating(true);
    setSelectedUser('');
    setLocalError('');
  };

  const displayError = localError || error;

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        {/* Logo 和标题 */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M15 8h2M15 12h2M7 16h10" />
            </svg>
          </div>
          <h1 className={styles.title}>证件水印处理系统</h1>
          <p className={styles.subtitle}>请选择用户登录</p>
        </div>

        {/* 用户列表 */}
        {!isCreating ? (
          <div className={styles.userList}>
            {users.length === 0 ? (
              <div className={styles.emptyUsers}>暂无用户</div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`${styles.userItem} ${selectedUser === user.id ? styles.selected : ''}`}
                  onClick={() => handleSelectUser(user.id)}
                >
                  <span className={styles.userAvatar}>
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.userName}>{user.username}</span>
                  {selectedUser === user.id && (
                    <span className={styles.checkmark}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </button>
              ))
            )}

            {/* 新建用户按钮 */}
            <button
              type="button"
              className={styles.createUserBtn}
              onClick={handleSwitchToCreate}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              新建用户
            </button>
          </div>
        ) : (
          /* 创建用户表单 */
          <form className={styles.createForm} onSubmit={handleCreateUser}>
            <div className={styles.inputGroup}>
              <label htmlFor="newUsername">用户名</label>
              <input
                id="newUsername"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="请输入用户名"
                autoFocus
                minLength={2}
                maxLength={20}
              />
            </div>
            <div className={styles.formActions}>
              <button
                type="button"
                className={`btn btn-secondary ${styles.backBtn}`}
                onClick={() => {
                  setIsCreating(false);
                  setNewUsername('');
                  setLocalError('');
                }}
              >
                返回
              </button>
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? '创建中...' : '创建'}
              </button>
            </div>
          </form>
        )}

        {/* 错误提示 */}
        {displayError && (
          <div className={styles.errorMessage}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {displayError}
          </div>
        )}

        {/* 登录按钮 */}
        {!isCreating && (
          <form onSubmit={handleLogin}>
            <button
              type="submit"
              className={`btn btn-primary btn-lg ${styles.loginBtn}`}
              disabled={isLoading || !selectedUser}
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
