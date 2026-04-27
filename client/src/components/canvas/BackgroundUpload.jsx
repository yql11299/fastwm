import { useState, useCallback, useRef, useEffect } from 'react';
import useAppStore from '../../stores/appStore';
import { documentsApi } from '../../api/client';
import styles from './BackgroundUpload.module.css';

/**
 * 背景加载组件
 * 从服务端文件目录加载图片/PDF作为背景
 */
export default function BackgroundUpload() {
  const { canvasBackground, setCanvasBackground, canvasSize, setCanvasSize } = useAppStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 文件选择弹窗状态
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [fileList, setFileList] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // 加载文件列表
  const loadFileList = useCallback(async (path = '') => {
    setLoadingFiles(true);
    setError('');
    try {
      const result = await documentsApi.getDocuments(path || '', 'jpg,jpeg,png,pdf');
      if (result.success) {
        setFileList(result.data.items || []);
        setCurrentPath(result.data.currentPath || path);
        setParentPath(result.data.parentPath ?? null);
      } else {
        setError(result.error?.message || '加载文件列表失败');
      }
    } catch (err) {
      setError('加载文件列表失败');
      console.error('Load file list error:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // 打开文件选择弹窗
  const handleOpenFileDialog = useCallback(() => {
    setShowFileDialog(true);
    loadFileList(currentPath);
  }, [currentPath, loadFileList]);

  // 关闭弹窗
  const handleCloseDialog = useCallback(() => {
    setShowFileDialog(false);
    setError('');
  }, []);

  // 点击目录进入
  const handleDirectoryClick = useCallback((path) => {
    loadFileList(path);
  }, [loadFileList]);

  // 点击返回上级目录
  const handleGoBack = useCallback(() => {
    if (parentPath !== null) {
      loadFileList(parentPath);
    }
  }, [parentPath, loadFileList]);

  // 点击选择文件作为背景
  const handleFileSelect = useCallback(async (file) => {
    if (file.isDirectory) {
      loadFileList(file.path);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await documentsApi.getDocumentContent(file.id);
      if (result.success) {
        const { content, mimeType, fileName } = result.data;
        const dataUrl = `data:${mimeType};base64,${content}`;

        if (mimeType === 'application/pdf') {
          setCanvasBackground({ type: 'pdf', dataUrl, fileName, fileId: file.id });
          setCanvasSize({ width: 595, height: 842 });
        } else {
          // 图片需要先获取尺寸
          const img = new Image();
          img.onload = () => {
            setCanvasSize({
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
            setCanvasBackground({ type: 'image', dataUrl, fileName, fileId: file.id });
          };
          img.onerror = () => {
            setError('图片加载失败');
          };
          img.src = dataUrl;
        }
        setShowFileDialog(false);
      } else {
        setError(result.error?.message || '文件加载失败');
      }
    } catch (err) {
      setError('文件加载失败');
      console.error('Load file content error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadFileList, setCanvasBackground, setCanvasSize]);

  // 清除背景
  const handleClear = useCallback(() => {
    setCanvasBackground(null);
    setCanvasSize({ width: 800, height: 600 });
    setError('');
  }, [setCanvasBackground, setCanvasSize]);

  // 拖拽处理（用于从外部拖拽文件到画布）
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

      // 注意：拖拽文件到此处暂时不支持
      // 因为需要先上传到服务器才能被加载
      setError('请使用"加载背景"按钮从服务器选择文件');
    },
    []
  );

  // 获取不带扩展名的文件名
  const getNameWithoutExtension = (name) => {
    return name.replace(/\.[^.]+$/, '');
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button className="btn btn-secondary btn-sm" onClick={handleOpenFileDialog} disabled={isLoading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          加载背景
        </button>

        {canvasBackground && (
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>
            清除背景
          </button>
        )}
      </div>

      {/* 拖拽提示（暂不支持） */}
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
          <span>点击"加载背景"从服务器选择文件</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && <div className={styles.error}>{error}</div>}

      {/* 加载指示 */}
      {(isLoading || loadingFiles) && <div className={styles.loading}>处理中...</div>}

      {/* 背景信息 */}
      {canvasBackground && (
        <div className={styles.info}>
          <span>
            背景尺寸: {canvasSize.width} × {canvasSize.height}
            {canvasBackground.fileName && ` - ${canvasBackground.fileName}`}
          </span>
        </div>
      )}

      {/* 文件选择弹窗 */}
      {showFileDialog && (
        <div className={styles.modalOverlay} onClick={handleCloseDialog}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>选择背景文件</h3>
              <button className={styles.closeBtn} onClick={handleCloseDialog}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalContent}>
              <p className={styles.dialogHint}>从服务器文件目录选择图片或 PDF 文件作为背景</p>

              {/* 路径导航 */}
              <div className={styles.pathNav}>
                <span className={styles.currentPath}>
                  {currentPath === '' ? '全部文件' : currentPath}
                </span>
              </div>

              {/* 返回上级按钮 */}
              {parentPath !== null && (
                <button className={styles.backBtn} onClick={handleGoBack}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  返回上级
                </button>
              )}

              {/* 文件列表 */}
              <div className={styles.fileList}>
                {loadingFiles ? (
                  <div className={styles.loadingFiles}>加载中...</div>
                ) : fileList.length === 0 ? (
                  <div className={styles.noFiles}>目录为空</div>
                ) : (
                  fileList.map((file) => (
                    <div
                      key={file.id}
                      className={`${styles.fileItem} ${file.isDirectory ? styles.directory : ''}`}
                      onClick={() => handleFileSelect(file)}
                    >
                      {file.isDirectory ? (
                        <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                      ) : file.type === 'pdf' ? (
                        <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      ) : (
                        <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      )}
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{getNameWithoutExtension(file.name)}</span>
                        {!file.isDirectory && (
                          <span className={styles.fileType}>.{file.type}</span>
                        )}
                      </div>
                      {file.isDirectory && (
                        <svg className={styles.arrowIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}