import { useState, useCallback, memo } from 'react';
import styles from './FolderTree.module.css';

/**
 * 目录树组件
 * 支持懒加载子目录、展开/折叠、文件类型过滤
 */
function FolderTree({ items = [], onFolderClick, selectedIds = [], onSelect }) {
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [loadingPaths, setLoadingPaths] = useState(new Set());

  // 切换展开/折叠状态
  const toggleExpand = useCallback(
    async (item) => {
      const path = item.path;

      if (expandedPaths.has(path)) {
        // 折叠
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      } else {
        // 展开（懒加载子目录）
        if (!item.children && onFolderClick) {
          setLoadingPaths((prev) => new Set(prev).add(path));
          try {
            await onFolderClick(item);
          } finally {
            setLoadingPaths((prev) => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
          }
        }
        setExpandedPaths((prev) => new Set(prev).add(path));
      }
    },
    [expandedPaths, onFolderClick]
  );

  // 过滤文件类型（只显示 jpg/png/pdf）
  const filterByExtension = (items, extensions = ['jpg', 'jpeg', 'png', 'pdf']) => {
    return items.filter((item) => {
      if (item.isDirectory) return true;
      const ext = item.name.split('.').pop()?.toLowerCase();
      return extensions.includes(ext);
    });
  };

  // 渲染单个项目
  const renderItem = (item, depth = 0) => {
    const isExpanded = expandedPaths.has(item.path);
    const isLoading = loadingPaths.has(item.path);
    const isSelected = selectedIds.includes(item.id);

    return (
      <div key={item.id} className={styles.treeItem}>
        {/* 目录/文件行 */}
        <div
          className={`${styles.itemRow} ${isSelected ? styles.selected : ''}`}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => {
            if (item.isDirectory) {
              toggleExpand(item);
            }
            if (onSelect) {
              onSelect(item);
            }
          }}
        >
          {/* 展开/折叠图标 */}
          {item.isDirectory && (
            <span className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}>
              {isLoading ? (
                <span className={styles.spinner} />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </span>
          )}

          {/* 图标 */}
          <span className={`${styles.itemIcon} ${item.isDirectory ? styles.folderIcon : styles.fileIcon}`}>
            {item.isDirectory ? (
              isExpanded ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              )
            ) : item.type?.toLowerCase() === 'pdf' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            )}
          </span>

          {/* 名称 */}
          <span className={styles.itemName}>{item.name}</span>

          {/* 复选框（仅文件） */}
          {!item.isDirectory && (
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={isSelected}
              onChange={() => {}}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>

        {/* 子目录 */}
        {item.isDirectory && isExpanded && item.children && (
          <div className={styles.children}>
            {filterByExtension(item.children).map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredItems = filterByExtension(items);

  return (
    <div className={styles.folderTree}>
      {filteredItems.length === 0 ? (
        <div className={styles.empty}>暂无文件</div>
      ) : (
        filteredItems.map((item) => renderItem(item))
      )}
    </div>
  );
}

export default memo(FolderTree);
