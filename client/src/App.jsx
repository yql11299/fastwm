import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './components/auth/Login';
import DocumentList from './components/documents/DocumentList';
import Canvas from './components/canvas/Canvas';
import LayoutCanvas from './components/canvas/LayoutCanvas';

/**
 * 画布路由包装器
 * 使用 searchParams 作为 key 强制在参数变化时重新挂载组件
 */
function CanvasRoute() {
  const [searchParams] = useSearchParams();
  // 当 backgroundId 变化时强制重新挂载 Canvas 组件
  const backgroundId = searchParams.get('backgroundId');
  return <Canvas key={backgroundId || 'empty'} />;
}

/**
 * 主应用组件
 * 根据认证状态决定显示登录还是主界面
 */
function App() {
  const { isAuthenticated, isLoading } = useAuth();

  // 加载中状态
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* 登录页 */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />

      {/* 主界面 - 证件列表首页 */}
      <Route path="/" element={isAuthenticated ? <DocumentList /> : <Navigate to="/login" />} />

      {/* 布局编辑器 - 调整布局模式 */}
      <Route path="/layout" element={isAuthenticated ? <LayoutCanvas /> : <Navigate to="/login" />} />

      {/* 画布模式 - 水印预览/编辑 */}
      <Route path="/canvas" element={isAuthenticated ? <CanvasRoute /> : <Navigate to="/login" />} />

      {/* 未匹配路由重定向 */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
