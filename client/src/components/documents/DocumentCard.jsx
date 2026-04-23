import { memo } from 'react';
import styles from './DocumentCard.module.css';

/**
 * 证件卡片组件
 * @param {Object} props
 * @param {Object} props.document - 证件对象 { id, name, path, type, size }
 * @param {boolean} props.isSelected - 是否选中
 * @param {Function} props.onSelect - 选中回调
 * @param {boolean} props.showCheckbox - 是否显示复选框
 */
function DocumentCard({ document, isSelected, onSelect, showCheckbox = true }) {
  // 获取文件类型图标
  const getTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
      case 'png':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        );
      case 'pdf':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <text x="7" y="17" fontSize="6" fill="currentColor" stroke="none">PDF</text>
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
    }
  };

  // 格式化文件大小
  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 获取不带后缀的文件名
  const getNameWithoutExtension = (name) => {
    if (!name) return '';
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(0, lastDot) : name;
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(document.id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
    >
      {showCheckbox && (
        <div className={styles.checkbox}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect && onSelect(document.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className={styles.icon}>{getTypeIcon(document.type)}</div>

      <div className={styles.info}>
        <span className={styles.name} title={document.name}>
          {getNameWithoutExtension(document.name)}
        </span>
        {document.size > 0 && <span className={styles.size}>{formatSize(document.size)}</span>}
      </div>

      {/* 选中遮罩 */}
      {isSelected && <div className={styles.selectedOverlay} />}
    </div>
  );
}

// 使用 memo 优化性能
export default memo(DocumentCard);
