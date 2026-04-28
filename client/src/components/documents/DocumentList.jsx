import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentsApi, layoutApi, processApi, schemesApi } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import useAppStore from '../../stores/appStore';
import SettingsModal from '../settings/SettingsModal';
import styles from './DocumentList.module.css';

/**
 * 证件列表页面（首页）
 * 只显示常用证件列表，提供水印输入和快速导出功能
 * 证件按照布局配置的 row/order 以网格形式展示
 */
export default function DocumentList() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const {
    selectedDocuments,
    setSelectedDocuments,
    toggleDocumentSelection,
    selectAllDocuments,
    clearSelection,
    favorites,
    setFavorites,
    layoutItems,
    setLayoutItems,
    watermark,
    setWatermark,
    isProcessing,
    setProcessing,
    schemes,
    setSchemes,
    setCurrentScheme,
  } = useAppStore();

  const [watermarkText, setWatermarkText] = useState(watermark.text);
  const [selectedSchemeId, setSelectedSchemeId] = useState('default');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 加载布局配置和常用证件列表
  useEffect(() => {
    const loadData = async () => {
      // 先加载布局配置
      const layoutResult = await layoutApi.getLayout();
      if (layoutResult.success && layoutResult.data?.items) {
        setLayoutItems(layoutResult.data.items);
      }
      // 再加载常用证件列表
      const favResult = await documentsApi.getFavorites();
      if (favResult.success) {
        setFavorites(favResult.data || []);
      }
    };
    loadData();
  }, [setLayoutItems, setFavorites]);

  // 加载预设方案
  useEffect(() => {
    const loadSchemes = async () => {
      const result = await schemesApi.getSchemes('preset');
      if (result.success) {
        setSchemes(result.data || []);
      }
    };
    loadSchemes();
  }, [setSchemes]);

  // 根据布局配置将证件分组显示
  const documentsByRow = useMemo(() => {
    const rowMap = {};
    favorites.forEach((doc) => {
      // 找到对应的布局配置
      const layoutItem = layoutItems.find((item) => item.fileId === doc.id);
      const row = layoutItem?.row ?? 0;
      if (!rowMap[row]) rowMap[row] = [];
      rowMap[row].push(doc);
    });
    // 按行号排序
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

  // 处理证件选择
  const handleSelect = useCallback((id) => {
    toggleDocumentSelection(id);
  }, [toggleDocumentSelection]);

  // 处理水印文字变化
  const handleWatermarkTextChange = (e) => {
    setWatermarkText(e.target.value);
  };

  // 更新全局水印文字
  useEffect(() => {
    setWatermark({ text: watermarkText });
  }, [watermarkText, setWatermark]);

  // 处理方案选择变化
  const handleSchemeChange = (e) => {
    const schemeId = e.target.value;
    setSelectedSchemeId(schemeId);

    if (schemeId === 'default') {
      // 默认方案：清空文字，让后端使用 defaultWatermark.text
      setWatermarkText('');
      setCurrentScheme(null);
    } else {
      // 预设方案
      const scheme = schemes.find((s) => s.id === schemeId);
      if (scheme) {
        setWatermark(scheme.watermark);
        setWatermarkText(scheme.watermark.text || '');
        setCurrentScheme(scheme);
      }
    }
  };

  // 处理新建方案（跳转到画布编辑模式）
  const handleNewScheme = () => {
    // 如果有选中的文件，传递第一个文件的ID和类型到画布
    const firstSelectedId = selectedDocuments.length > 0 ? selectedDocuments[0] : null;
    const firstSelectedDoc = firstSelectedId ? favorites.find(f => f.id === firstSelectedId) : null;

    if (firstSelectedDoc) {
      // 传递选中文件的信息用于自动加载背景
      const params = new URLSearchParams({
        mode: 'edit',
        backgroundId: firstSelectedDoc.id,
        backgroundType: firstSelectedDoc.type || 'unknown',
      });
      navigate(`/canvas?${params.toString()}`);
    } else {
      navigate('/canvas?mode=edit');
    }
  };

  // 处理调整布局
  const handleAdjustLayout = () => {
    navigate('/layout');
  };

  // 处理一键生成
  const handleGenerate = async () => {
    if (selectedDocuments.length === 0) {
      alert('请选择至少一个证件文件');
      return;
    }

    setProcessing(true);
    try {
      // 传递 schemeId 和 text（text 用于覆盖方案中的文本）
      // schemeId 为 'default' 时使用用户的默认水印配置
      const result = await processApi.processWatermark({
        schemeId: selectedSchemeId,
        text: watermarkText.trim(),
        fileIds: selectedDocuments,
        exportConfig: {
          namingRule: 'timestamp_text',
          quality: 100,
        },
      });

      if (result.success && result.data?.taskId) {
        if (result.data.status === 'completed') {
          await processApi.downloadResult(result.data.taskId, selectedDocuments.length === 1 ? 'file' : 'zip');
        } else {
          const taskId = result.data.taskId;
          let attempts = 0;
          const maxAttempts = 30;

          while (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const statusResult = await processApi.getStatus(taskId);

            if (statusResult.success && statusResult.data?.status === 'completed') {
              await processApi.downloadResult(taskId, selectedDocuments.length === 1 ? 'file' : 'zip');
              break;
            }
            attempts++;
          }

          if (attempts >= maxAttempts) {
            alert('处理超时，请稍后重试');
          }
        }
      } else {
        alert('处理失败，请稍后重试');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('处理失败，请稍后重试');
    } finally {
      setProcessing(false);
    }
  };

  // 登出
  const handleLogout = async () => {
    await logout();
  };

  // 去掉文件名扩展名
  const getNameWithoutExtension = (name) => {
    return name.replace(/\.[^.]+$/, '');
  };

  const displayDocuments = favorites;

  return (
    <div className={styles.container}>
      {/* 顶部导航栏 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.logo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M7 16h10" />
            </svg>
            证件水印处理系统
          </h1>
        </div>

        <div className={styles.headerRight}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)}>
            设置
          </button>
          <div className={styles.userInfo}>
            <span className={styles.userAvatar}>{currentUser?.username?.charAt(0).toUpperCase()}</span>
            <span className={styles.userName}>{currentUser?.username}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowLogoutConfirm(true)}>
            登出
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className={styles.main}>
        {/* 标题区 */}
        <div className={styles.titleSection}>
          <h2>常用证件</h2>
          <div className={styles.titleActions}>
            <span className={styles.count}>{displayDocuments.length} 个文件</span>
            <button className="btn btn-secondary btn-sm" onClick={handleAdjustLayout}>
              调整布局
            </button>
          </div>
        </div>

        {/* 操作栏 */}
        <div className={styles.toolbar}>
          <span className={styles.selectedCount}>已选择 {selectedDocuments.length} 项</span>
        </div>

        {/* 证件列表 - 按照布局配置显示 */}
        <div className={styles.documentList}>
          {displayDocuments.length === 0 ? (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <p>暂无常用证件</p>
              <p className={styles.emptyHint}>点击"调整布局"添加证件</p>
            </div>
          ) : (
            documentsByRow.map(({ row, items }) => (
              <div key={row} className={styles.documentRow}>
                {items.map((doc) => (
                  <label
                    key={doc.id}
                    className={`${styles.docItem} ${selectedDocuments.includes(doc.id) ? styles.selected : ''}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.docCheckbox}
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={() => handleSelect(doc.id)}
                    />
                    <span className={styles.docName}>{getNameWithoutExtension(doc.name)}</span>
                  </label>
                ))}
              </div>
            ))
          )}
        </div>

        {/* 底部操作栏 */}
        <div className={styles.bottomBar}>
          <div className={styles.watermarkSection}>
            <div className={styles.watermarkRow}>
              <label htmlFor="watermarkText">水印文字:</label>
              <input
                id="watermarkText"
                type="text"
                value={watermarkText}
                onChange={handleWatermarkTextChange}
                placeholder="请输入水印文字"
                className={styles.textInput}
              />
            </div>

            <div className={styles.schemeRow}>
              <label htmlFor="schemeSelect">预设方案:</label>
              <select
                id="schemeSelect"
                value={selectedSchemeId}
                onChange={handleSchemeChange}
                className={styles.select}
              >
                <option value="default">-- 默认方案 --</option>
                {schemes.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleNewScheme}
            >
              新建方案
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleGenerate}
              disabled={selectedDocuments.length === 0 || isProcessing}
            >
              {isProcessing ? '处理中...' : '一键生成'}
            </button>
          </div>
        </div>
      </main>

      {/* 登出确认弹窗 */}
      {showLogoutConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>确认登出</h3>
            <p>确定要退出登录吗？</p>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowLogoutConfirm(false)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={handleLogout}>
                确认登出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
