import { useState, useCallback } from 'react';
import { schemesApi } from '../../api/client';
import styles from './SchemeSaveModal.module.css';

/**
 * 方案保存弹窗组件
 * 保存方案名称，设为预设选项
 */
export default function SchemeSaveModal({ watermark, onSave, onClose }) {
  const [name, setName] = useState('');
  const [isPreset, setIsPreset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // 处理保存
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('请输入方案名称');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const result = await schemesApi.createScheme({
        name: name.trim(),
        isPreset,
        watermark,
      });

      if (result.success && result.data) {
        onSave(result.data);
      } else {
        throw new Error(result.error?.message || '保存失败');
      }
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [name, isPreset, watermark, onSave]);

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isSaving) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className={styles.header}>
          <h2>保存方案</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {/* 方案名称 */}
          <div className={styles.field}>
            <label htmlFor="schemeName">方案名称</label>
            <input
              id="schemeName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入方案名称"
              autoFocus
              maxLength={50}
            />
          </div>

          {/* 设为预设 */}
          <div className={styles.field}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={isPreset}
                onChange={(e) => setIsPreset(e.target.checked)}
              />
              <span>设为预设方案</span>
            </label>
            <p className={styles.hint}>预设方案将在首页导出时可见</p>
          </div>

          {/* 预览 */}
          <div className={styles.preview}>
            <label>预览</label>
            <div className={styles.previewBox}>
              <span style={{ color: watermark.color }}>{watermark.text || '水印文字'}</span>
            </div>
          </div>

          {/* 错误提示 */}
          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.footer}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
