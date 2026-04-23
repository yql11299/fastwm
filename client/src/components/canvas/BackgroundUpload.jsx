import { useState, useCallback, useRef } from 'react';
import useAppStore from '../../stores/appStore';
import styles from './BackgroundUpload.module.css';

/**
 * 背景上传组件
 * 加载背景图片/PDF预览
 */
export default function BackgroundUpload() {
  const { canvasBackground, setCanvasBackground, canvasSize, setCanvasSize } = useAppStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // 处理文件
  const processFile = useCallback(
    (file) => {
      setError('');
      setIsLoading(true);

      // 验证文件类型
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        setError('仅支持 JPG、PNG、PDF 文件');
        setIsLoading(false);
        return;
      }

      // 验证文件大小（最大 20MB）
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('文件大小不能超过 20MB');
        setIsLoading(false);
        return;
      }

      // 处理文件
      const reader = new FileReader();

      reader.onload = (e) => {
        const dataUrl = e.target.result;

        if (file.type === 'application/pdf') {
          // PDF: 存储 dataUrl，Canvas 会用 pdf.js 渲染
          setCanvasBackground({ type: 'pdf', dataUrl });
          // 设置默认 A4 尺寸，之后 pdf.js 会更新
          setCanvasSize({ width: 595, height: 842 });
        } else {
          // 图片处理
          const img = new Image();
          img.onload = () => {
            setCanvasSize({
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
            setCanvasBackground({ type: 'image', dataUrl });
          };
          img.onerror = () => {
            setError('图片加载失败');
          };
          img.src = dataUrl;
        }

        setIsLoading(false);
      };

      reader.onerror = () => {
        setError('文件读取失败');
        setIsLoading(false);
      };

      reader.readAsDataURL(file);
    },
    [setCanvasBackground, setCanvasSize]
  );

  // 处理文件选择
  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  // 拖拽处理
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  // 清除背景
  const handleClear = useCallback(() => {
    setCanvasBackground(null);
    setCanvasSize({ width: 800, height: 600 });
    setError('');
  }, [setCanvasBackground, setCanvasSize]);

  // 点击上传
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button className="btn btn-secondary btn-sm" onClick={handleClick} disabled={isLoading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          加载背景
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {canvasBackground && (
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>
            清除背景
          </button>
        )}
      </div>

      {/* 拖拽提示 */}
      {!canvasBackground && (
        <div
          className={`${styles.dropHint} ${isDragOver ? styles.active : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span>拖拽图片到此处作为背景</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && <div className={styles.error}>{error}</div>}

      {/* 加载指示 */}
      {isLoading && <div className={styles.loading}>处理中...</div>}

      {/* 背景信息 */}
      {canvasBackground && (
        <div className={styles.info}>
          <span>
            背景尺寸: {canvasSize.width} × {canvasSize.height}
          </span>
        </div>
      )}
    </div>
  );
}