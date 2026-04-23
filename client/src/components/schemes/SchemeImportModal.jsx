import { useState, useCallback, useRef } from 'react';
import { schemesApi } from '../../api/client';
import styles from './SchemeImportModal.module.css';

/**
 * 方案导入/导出弹窗组件
 * JSON文件导入，导出下载
 */
export default function SchemeImportModal({ onImport, onClose }) {
  const [mode, setMode] = useState('import'); // 'import' | 'export'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);

  // 处理文件选择
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.json')) {
      setError('请选择 JSON 文件');
      return;
    }

    setSelectedFile(file);
    setError('');

    // 预览文件内容
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.watermark) {
          setPreviewData(data);
        } else {
          setError('无效的方案文件');
          setPreviewData(null);
        }
      } catch {
        setError('文件解析失败');
        setPreviewData(null);
      }
    };
    reader.readAsText(file);
  }, []);

  // 处理导入
  const handleImport = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError('');

    try {
      const result = await schemesApi.importScheme(selectedFile);
      if (result.success && result.data) {
        onImport(result.data);
      } else {
        throw new Error(result.error?.message || '导入失败');
      }
    } catch (err) {
      setError(err.message || '导入失败');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, onImport]);

  // 拖拽处理
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleFileChange(fakeEvent);
    }
  }, [handleFileChange]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>导入/导出方案</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {/* 模式切换 */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === 'import' ? styles.active : ''}`}
              onClick={() => setMode('import')}
            >
              导入
            </button>
            <button
              className={`${styles.tab} ${mode === 'export' ? styles.active : ''}`}
              onClick={() => setMode('export')}
            >
              导出说明
            </button>
          </div>

          {mode === 'import' ? (
            <>
              {/* 拖拽上传区域 */}
              <div
                className={styles.dropZone}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>点击或拖拽上传 JSON 文件</p>
                <p className={styles.hint}>支持从其他系统导出的水印方案文件</p>
              </div>

              {/* 选中文件预览 */}
              {selectedFile && (
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>{selectedFile.name}</span>
                  </div>
                </div>
              )}

              {/* 方案预览 */}
              {previewData && (
                <div className={styles.preview}>
                  <h4>方案预览</h4>
                  <div className={styles.previewContent}>
                    <div className={styles.previewRow}>
                      <span>名称:</span>
                      <span>{previewData.name}</span>
                    </div>
                    <div className={styles.previewRow}>
                      <span>水印文字:</span>
                      <span>{previewData.watermark?.text}</span>
                    </div>
                    <div className={styles.previewRow}>
                      <span>字体:</span>
                      <span>{previewData.watermark?.font}</span>
                    </div>
                    <div className={styles.previewRow}>
                      <span>颜色:</span>
                      <span style={{ color: previewData.watermark?.color }}>
                        {previewData.watermark?.color}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 错误提示 */}
              {error && <div className={styles.error}>{error}</div>}
            </>
          ) : (
            /* 导出说明 */
            <div className={styles.exportInfo}>
              <h4>导出方案</h4>
              <p>在方案列表页面，点击任意方案的"导出"按钮即可下载 JSON 文件。</p>

              <h4>导入方案</h4>
              <p>
                1. 点击"导入"标签切换到导入模式
                <br />
                2. 选择或拖拽 JSON 文件到上传区域
                <br />
                3. 确认方案信息后点击"导入"
              </p>

              <h4>注意事项</h4>
              <ul>
                <li>仅支持 JSON 格式的方案文件</li>
                <li>导入的方案将自动转为普通方案</li>
                <li>如需分享预设方案，请导出后让对方在"预设管理"中导入</li>
              </ul>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className="btn btn-secondary" onClick={onClose}>
            关闭
          </button>
          {mode === 'import' && (
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!selectedFile || !previewData || isProcessing}
            >
              {isProcessing ? '导入中...' : '导入'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
