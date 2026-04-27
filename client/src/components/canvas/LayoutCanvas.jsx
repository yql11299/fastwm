import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { layoutApi, documentsApi } from '../../api/client';
import useAppStore from '../../stores/appStore';
import styles from './LayoutCanvas.module.css';

/**
 * 布局画布组件
 * 拖拽调整常用证件位置
 * 证件排列和显示与首页完全一致
 * 拖拽逻辑：类 Trello/Notion 风格
 * - 拖拽时显示半透明幽灵元素跟随鼠标
 * - 目标位置显示占位符
 * - 目标位置与原位置之间的元素显示退位动画
 * - 支持跨行移动（拖拽元素本身可以移动到其他行）
 * - 占位符和退位效果限制在同一行内
 * - 最下方始终保留一个空行用于创建新行
 */
export default function LayoutCanvas() {
  const navigate = useNavigate();
  const {
    favorites,
    setFavorites,
    layoutItems,
    setLayoutItems,
  } = useAppStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);

  // 文件选择弹窗状态（与 BackgroundUpload 一致的目录浏览）
  const [fileCurrentPath, setFileCurrentPath] = useState('');
  const [fileList, setFileList] = useState([]);
  const [fileParentPath, setFileParentPath] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // 拖拽状态
  const [draggedId, setDraggedId] = useState(null);
  const [draggedFromRow, setDraggedFromRow] = useState(null);
  const [draggedFromIndex, setDraggedFromIndex] = useState(null);
  const [dropRow, setDropRow] = useState(null);     // 放置目标行
  const [dropIndex, setDropIndex] = useState(null);  // 放置目标索引

  // 拖拽位置状态
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const itemsRef = useRef({});
  const fileInputRef = useRef(null);

  // 加载常用证件列表和布局
  useEffect(() => {
    const loadData = async () => {
      const layoutResult = await layoutApi.getLayout();
      if (layoutResult.success && layoutResult.data?.items) {
        setLayoutItems(layoutResult.data.items);
      }
      const favResult = await documentsApi.getFavorites();
      if (favResult.success) {
        setFavorites(favResult.data || []);
      }
    };
    loadData();
  }, [setFavorites, setLayoutItems]);

  // 加载文件列表（与 BackgroundUpload 一致的目录浏览逻辑）
  const loadFileList = useCallback(async (path = '') => {
    setLoadingFiles(true);
    try {
      const result = await documentsApi.getDocuments(path || '', 'jpg,jpeg,png,pdf');
      if (result.success) {
        setFileList(result.data.items || []);
        setFileCurrentPath(result.data.currentPath || path);
        setFileParentPath(result.data.parentPath || null);
      }
    } catch (err) {
      console.error('Load file list error:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // 打开添加弹窗时加载文件列表
  useEffect(() => {
    if (showAddDialog) {
      setSelectedToAdd([]);
      loadFileList(fileCurrentPath);
    }
  }, [showAddDialog, fileCurrentPath, loadFileList]);

  // 返回上级目录
  const handleGoBack = useCallback(() => {
    if (fileParentPath !== null) {
      loadFileList(fileParentPath);
    }
  }, [fileParentPath, loadFileList]);

  // 点击目录进入
  const handleDirectoryClick = useCallback((path) => {
    loadFileList(path);
  }, [loadFileList]);

  // 根据布局配置将证件分组显示（与首页一致）
  const documentsByRow = useMemo(() => {
    const rowMap = {};
    favorites.forEach((doc) => {
      const layoutItem = layoutItems.find((item) => item.fileId === doc.id);
      const row = layoutItem?.row ?? 0;
      if (!rowMap[row]) rowMap[row] = [];
      rowMap[row].push(doc);
    });
    return Object.keys(rowMap)
      .map(Number)
      .sort((a, b) => a - b)
      .map((row) => ({
        row,
        items: rowMap[row].sort((a, b) => {
          const layoutA = layoutItems.find((item) => item.fileId === a.id);
          const layoutB = layoutItems.find((item) => item.fileId === b.id);
          return (layoutA?.order ?? 0) - (layoutB?.order ?? 0);
        }),
      }));
  }, [favorites, layoutItems]);

  // 计算最大行号
  const maxRow = useMemo(() => {
    if (documentsByRow.length === 0) return -1;
    return Math.max(...documentsByRow.map(r => r.row));
  }, [documentsByRow]);

  // 下一个新行的行号
  const nextNewRow = maxRow + 1;

  // 去掉文件名扩展名
  const getNameWithoutExtension = (name) => {
    return name.replace(/\.[^.]+$/, '');
  };

  // ========== 拖拽逻辑（鼠标事件版） ==========

  // 计算某个位置的元素应该显示在哪个索引
  const calculateDropIndex = useCallback((rowElement, clientX, clientY, excludeId) => {
    if (!rowElement) return 0;

    const items = Array.from(rowElement.querySelectorAll('[data-doc-id]'))
      .filter(el => el.dataset.docId !== excludeId);

    if (items.length === 0) return 0;

    let closestIndex = 0;
    let closestDistance = Infinity;

    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.sqrt(
        Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        const isLeft = clientX < centerX;
        const index = parseInt(item.dataset.index, 10);
        closestIndex = isLeft ? index : index + 1;
      }
    });

    return closestIndex;
  }, []);

  // 鼠标按下 - 开始拖拽
  const handleMouseDown = useCallback((e, doc, row, index) => {
    if (e.button !== 0) return;

    e.preventDefault();

    const item = itemsRef.current[doc.id];
    if (!item) return;

    const rect = item.getBoundingClientRect();

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggedId(doc.id);
    setDraggedFromRow(row);
    setDraggedFromIndex(index);
    setDropRow(row);
    setDropIndex(index);
    setDragOffset({ x: offsetX, y: offsetY });
    setDragPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
  }, []);

  // 鼠标移动 - 跟随拖拽
  const handleMouseMove = useCallback((e) => {
    if (!draggedId) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    setDragPosition({ x: newX, y: newY });

    // 找到鼠标下的元素
    const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY);

    let targetRow = null;
    let targetRowElement = null;

    for (const el of elementsUnderMouse) {
      // 检查是否是行容器
      if (el.dataset && el.dataset.row !== undefined) {
        targetRow = parseInt(el.dataset.row, 10);
        targetRowElement = el;
        break;
      }
      // 检查是否是行尾占位符
      if (el.dataset && el.dataset.rowEnd !== undefined) {
        targetRow = parseInt(el.dataset.rowEnd, 10);
        targetRowElement = containerRef.current?.querySelector(`[data-row="${targetRow}"]`);
        break;
      }
      // 检查是否是新行占位符
      if (el.dataset && el.dataset.newRow !== undefined) {
        targetRow = nextNewRow;
        // 新行没有容器，特殊处理
        targetRowElement = null;
        break;
      }
    }

    if (targetRow !== null) {
      setDropRow(targetRow);
      if (targetRowElement) {
        const newIndex = calculateDropIndex(targetRowElement, e.clientX, e.clientY, draggedId);
        setDropIndex(newIndex);
      } else {
        // 新行的放置索引始终是 0
        setDropIndex(0);
      }
    }
  }, [draggedId, dragOffset, calculateDropIndex, nextNewRow]);

  // 鼠标释放 - 放置
  const handleMouseUp = useCallback(() => {
    if (!draggedId || dropRow === null) {
      handleDragEnd();
      return;
    }

    const targetRow = dropRow;
    const targetIndex = dropIndex ?? 0;

    // 如果位置没有变化，不做任何操作
    if (targetRow === draggedFromRow && targetIndex === draggedFromIndex) {
      handleDragEnd();
      return;
    }

    // 执行移动逻辑
    const newLayoutItems = [...layoutItems];

    // 找到源项的布局信息
    const sourceLayoutIndex = newLayoutItems.findIndex(item => item.fileId === draggedId);
    if (sourceLayoutIndex === -1) {
      handleDragEnd();
      return;
    }

    const sourceLayout = { ...newLayoutItems[sourceLayoutIndex] };
    newLayoutItems.splice(sourceLayoutIndex, 1);

    // 如果是跨行移动或移动到新行
    if (targetRow !== draggedFromRow) {
      // 目标行添加
      sourceLayout.row = targetRow;
      sourceLayout.order = Math.max(0, targetIndex);

      // 重新整理目标行的顺序
      const targetRowItems = newLayoutItems.filter(item => item.row === targetRow);
      const otherRowItems = newLayoutItems.filter(item => item.row !== targetRow);

      // 按 order 排序
      targetRowItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // 在目标位置插入
      targetRowItems.splice(targetIndex, 0, sourceLayout);

      // 重新分配 order
      targetRowItems.forEach((item, i) => {
        item.order = i;
      });

      // 合并
      const finalLayout = [...otherRowItems, ...targetRowItems];
      setLayoutItems(finalLayout);
    } else {
      // 同一行内移动
      const rowLayoutItems = newLayoutItems.filter(item => item.row === draggedFromRow);
      const otherRowLayoutItems = newLayoutItems.filter(item => item.row !== draggedFromRow);

      // 按order排序
      rowLayoutItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // 移除源项
      const filteredRowItems = rowLayoutItems.filter(item => item.fileId !== draggedId);

      // 在目标位置插入源项
      const insertIndex = targetIndex > draggedFromIndex ? targetIndex - 1 : targetIndex;
      filteredRowItems.splice(Math.max(0, insertIndex), 0, sourceLayout);

      // 重新分配order
      filteredRowItems.forEach((item, i) => {
        item.order = i;
      });

      // 合并回新布局
      const finalLayout = [...otherRowLayoutItems, ...filteredRowItems];
      setLayoutItems(finalLayout);
    }

    handleDragEnd();
  }, [draggedId, draggedFromRow, draggedFromIndex, dropRow, dropIndex, layoutItems, setLayoutItems]);

  // 结束拖拽
  const handleDragEnd = () => {
    setDraggedId(null);
    setDraggedFromRow(null);
    setDraggedFromIndex(null);
    setDropRow(null);
    setDropIndex(null);
    setDragOffset({ x: 0, y: 0 });
    setDragPosition({ x: 0, y: 0 });
    setIsDragging(false);
  };

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // ========== 删除功能 ==========

  const handleDelete = (id) => {
    setFavorites(favorites.filter(f => f.id !== id));
    setLayoutItems(layoutItems.filter(item => item.fileId !== id));
  };

  // ========== 添加功能 ==========

  const handleAddClick = () => {
    setShowAddDialog(true);
    setSelectedToAdd([]);
  };

  const toggleSelectToAdd = (docId) => {
    setSelectedToAdd(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleConfirmAdd = () => {
    if (selectedToAdd.length === 0) return;

    const newFavorites = [...favorites];
    const newLayoutItems = [...layoutItems];
    let nextRow = maxRow + 1;

    selectedToAdd.forEach(docId => {
      const doc = fileList.find(d => d.id === docId);
      if (doc) {
        newFavorites.push(doc);
        newLayoutItems.push({
          fileId: doc.id,
          fileName: doc.name,
          filePath: doc.path,
          fileType: doc.type,
          row: nextRow,
          order: 0,
        });
        nextRow++;
      }
    });

    setFavorites(newFavorites);
    setLayoutItems(newLayoutItems);
    setShowAddDialog(false);
    setSelectedToAdd([]);
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let nextRow = maxRow + 1;
    const newFavorites = [...favorites];
    const newLayoutItems = [...layoutItems];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
        const newDoc = {
          id: `local_${Date.now()}_${i}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          path: URL.createObjectURL(file),
          type: ext,
          size: file.size,
          isDirectory: false,
        };
        newFavorites.push(newDoc);
        newLayoutItems.push({
          fileId: newDoc.id,
          fileName: newDoc.name,
          filePath: newDoc.path,
          fileType: newDoc.type,
          row: nextRow,
          order: 0,
        });
        nextRow++;
      }
    }

    setFavorites(newFavorites);
    setLayoutItems(newLayoutItems);
    e.target.value = '';
  };

  // ========== 保存与取消 ==========

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      // 压缩行号（移除空行）
      const newLayoutItems = [];
      let newRow = 0;
      const rowMap = {};

      favorites.forEach(fav => {
        const item = layoutItems.find(i => i.fileId === fav.id);
        const row = item?.row ?? 0;
        if (rowMap[row] === undefined) {
          rowMap[row] = newRow++;
        }
        const targetRow = rowMap[row];
        newLayoutItems.push({
          fileId: fav.id,
          fileName: fav.name,
          filePath: fav.path,
          fileType: fav.type,
          row: targetRow,
          order: newLayoutItems.filter(i => i.row === targetRow).length,
        });
      });

      const result = await layoutApi.saveLayout(newLayoutItems);
      if (result.success) {
        setLayoutItems(newLayoutItems);
        setSaveMessage('布局保存成功');
        setTimeout(() => {
          setSaveMessage('');
          navigate('/');
        }, 1500);
      } else {
        setSaveMessage('保存失败');
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveMessage('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  // ========== 渲染判断 ==========

  // 判断证件项是否应该显示退位效果（同 row 内）
  const shouldShowRetreat = useCallback((docId, row, index) => {
    if (!draggedId || draggedId === docId) return false;
    // 退位效果只在同一行内
    if (row !== draggedFromRow) return false;
    // 跨行移动时不显示退位效果
    if (dropRow !== draggedFromRow) return false;

    if (dropIndex === null || draggedFromIndex === null) return false;

    if (draggedFromIndex < dropIndex) {
      return index > draggedFromIndex && index <= dropIndex;
    } else if (draggedFromIndex > dropIndex) {
      return index >= dropIndex && index < draggedFromIndex;
    }
    return false;
  }, [draggedId, draggedFromRow, dropRow, dropIndex, draggedFromIndex]);

  // 判断是否显示占位符（目标位置，同 row 内）
  const shouldShowPlaceholder = useCallback((row, index) => {
    if (!draggedId) return false;
    // 占位符只在同一行内
    if (row !== draggedFromRow) return false;
    // 跨行移动时不显示占位符
    if (dropRow !== draggedFromRow) return false;
    if (dropIndex === null || draggedFromIndex === null) return false;

    if (draggedFromIndex < dropIndex) {
      return index === draggedFromIndex;
    } else if (draggedFromIndex > dropIndex) {
      return index === dropIndex;
    }
    return false;
  }, [draggedId, draggedFromRow, dropRow, dropIndex, draggedFromIndex]);

  // 判断是否显示行尾占位符
  const shouldShowRowEndPlaceholder = useCallback((row) => {
    if (!draggedId) return false;
    // 占位符只在同一行内
    if (row !== draggedFromRow) return false;
    // 跨行移动时用新行占位符
    if (dropRow !== draggedFromRow) return false;
    if (dropIndex === null) return false;

    const rowData = documentsByRow.find(r => r.row === row);
    if (!rowData) return false;

    return dropIndex >= rowData.items.length;
  }, [draggedId, draggedFromRow, dropRow, dropIndex, documentsByRow]);

  // 判断是否显示新行占位符（始终显示）
  const shouldShowNewRowPlaceholder = useCallback(() => {
    if (!draggedId) return false;
    // 只有跨行移动时才能拖到新行
    return dropRow === nextNewRow;
  }, [draggedId, dropRow, nextNewRow]);

  // 获取拖拽元素的样式
  const getDragGhostStyle = () => {
    if (!isDragging) return {};
    return {
      position: 'fixed',
      left: dragPosition.x,
      top: dragPosition.y,
      width: itemsRef.current[draggedId]?.offsetWidth || 100,
      height: itemsRef.current[draggedId]?.offsetHeight || 32,
      zIndex: 9999,
      pointerEvents: 'none',
      opacity: 0.9,
      transform: 'rotate(2deg)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    };
  };

  // 获取被拖拽项的渲染数据
  const getDraggedDoc = useCallback(() => {
    if (!draggedId) return null;
    for (const row of documentsByRow) {
      const doc = row.items.find(d => d.id === draggedId);
      if (doc) return doc;
    }
    return null;
  }, [draggedId, documentsByRow]);

  const draggedDoc = getDraggedDoc();

  return (
    <div className={styles.container}>
      {/* 顶部导航栏 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={handleCancel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            返回
          </button>
          <h1 className={styles.title}>调整布局</h1>
        </div>

        <div className={styles.headerRight}>
          {saveMessage && <span className={styles.saveMessage}>{saveMessage}</span>}
          <button className="btn btn-secondary" onClick={handleCancel}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存布局'}
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className={styles.main}>
        {/* 说明 */}
        <div className={styles.instructions}>
          <p>拖拽证件可以调整位置。拖入垃圾桶可删除证件。</p>
        </div>

        {/* 操作栏 */}
        <div className={styles.toolbar}>
          <button className="btn btn-primary" onClick={handleAddClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            添加证件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* 证件列表 - 与首页显示完全一致 */}
        <div className={styles.documentList} ref={containerRef}>
          {favorites.length === 0 ? (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <p>暂无常用证件</p>
              <p className={styles.emptyHint}>点击"添加证件"添加文件</p>
            </div>
          ) : (
            <>
              {documentsByRow.map(({ row, items }) => (
                <div key={row} className={styles.documentRow} data-row={row}>
                  {items.map((doc, index) => {
                    const isDraggingThis = draggedId === doc.id;
                    const isRetreat = shouldShowRetreat(doc.id, row, index);
                    const showPlaceholder = shouldShowPlaceholder(row, index);

                    return (
                      <div key={doc.id} className={styles.docItemWrapper}>
                        {/* 占位符 - 显示在目标位置 */}
                        {showPlaceholder && (
                          <div className={styles.placeholder} />
                        )}
                        {/* 证件项 */}
                        <div
                          ref={(el) => { itemsRef.current[doc.id] = el; }}
                          data-doc-id={doc.id}
                          data-index={index}
                          className={`${styles.docItem} ${isDraggingThis ? styles.dragging : ''} ${isRetreat ? styles.retreat : ''}`}
                          onMouseDown={(e) => !isDraggingThis && handleMouseDown(e, doc, row, index)}
                        >
                          {/* 拖拽手柄 */}
                          <div className={styles.dragHandle}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                              <circle cx="9" cy="6" r="1.5" />
                              <circle cx="15" cy="6" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" />
                              <circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="18" r="1.5" />
                              <circle cx="15" cy="18" r="1.5" />
                            </svg>
                          </div>
                          <span className={styles.docName}>{getNameWithoutExtension(doc.name)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {/* 行尾占位符 */}
                  <div
                    className={`${styles.rowEndPlaceholder} ${shouldShowRowEndPlaceholder(row) ? styles.rowEndPlaceholderActive : ''}`}
                    data-row-end={row}
                  >
                    <span>拖拽到此处</span>
                  </div>
                </div>
              ))}

              {/* 新行占位符 - 用于跨行移动或添加新行，始终显示 */}
              <div
                className={`${styles.newRowPlaceholder} ${shouldShowNewRowPlaceholder() ? styles.newRowPlaceholderActive : ''}`}
                data-new-row={nextNewRow}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>拖拽到此处创建新行</span>
              </div>
            </>
          )}
        </div>

        {/* 拖拽幽灵元素 */}
        {isDragging && draggedDoc && (
          <div
            className={`${styles.docItem} ${styles.dragGhost}`}
            style={getDragGhostStyle()}
          >
            <div className={styles.dragHandle}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </div>
            <span className={styles.docName}>{getNameWithoutExtension(draggedDoc.name)}</span>
          </div>
        )}

        {/* 垃圾桶区域 */}
        <div
          className={`${styles.trashZone} ${isDragging ? styles.active : ''}`}
          onMouseUp={() => {
            if (draggedId) {
              handleDelete(draggedId);
              handleDragEnd();
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          <span>拖拽到此处删除</span>
        </div>
      </main>

      {/* 添加证件弹窗 */}
      {showAddDialog && (
        <div className={styles.modalOverlay} onClick={() => setShowAddDialog(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>添加证件</h3>
              <button className={styles.closeBtn} onClick={() => setShowAddDialog(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalContent}>
              <p className={styles.dialogHint}>从服务器文件目录选择证件添加到常用列表</p>

              {/* 路径导航 */}
              <div className={styles.pathNav}>
                <span className={styles.currentPath}>
                  {fileCurrentPath === '' ? '全部文件' : fileCurrentPath}
                </span>
              </div>

              {/* 返回上级按钮 */}
              {fileParentPath !== null && (
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
                      className={`${styles.fileItem} ${file.isDirectory ? styles.directory : ''} ${selectedToAdd.includes(file.id) ? styles.selected : ''}`}
                      onClick={() => {
                        if (file.isDirectory) {
                          handleDirectoryClick(file.path);
                        } else {
                          toggleSelectToAdd(file.id);
                        }
                      }}
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
                      {!file.isDirectory && (
                        <div className={styles.checkbox}>
                          {selectedToAdd.includes(file.id) && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      )}
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
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowAddDialog(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmAdd}
                disabled={selectedToAdd.length === 0}
              >
                添加 ({selectedToAdd.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
