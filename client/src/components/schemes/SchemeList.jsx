import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { schemesApi } from '../../api/client';
import useAppStore from '../../stores/appStore';
import SchemeSaveModal from './SchemeSaveModal';
import SchemeImportModal from './SchemeImportModal';
import styles from './SchemeList.module.css';

/**
 * 方案列表组件
 * 显示已保存方案，区分预设/普通方案
 */
export default function SchemeList() {
  const navigate = useNavigate();
  const { watermark, setWatermark, setCurrentScheme } = useAppStore();

  const [schemes, setSchemes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'preset' | 'common'
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  // 加载方案列表
  useEffect(() => {
    const loadSchemes = async () => {
      setIsLoading(true);
      try {
        const result = await schemesApi.getSchemes(filter);
        if (result.success) {
          setSchemes(result.data || []);
        }
      } catch (err) {
        console.error('Failed to load schemes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchemes();
  }, [filter]);

  // 加载方案详情并应用
  const handleLoadScheme = useCallback(
    async (schemeId) => {
      try {
        const result = await schemesApi.getScheme(schemeId);
        if (result.success && result.data?.watermark) {
          setWatermark(result.data.watermark);
          setCurrentScheme(result.data);
          showMessage('方案已加载');
          navigate('/canvas');
        }
      } catch (err) {
        showMessage('加载方案失败');
      }
    },
    [setWatermark, setCurrentScheme, navigate]
  );

  // 导出方案
  const handleExportScheme = useCallback(async (schemeId) => {
    try {
      await schemesApi.exportScheme(schemeId);
      showMessage('方案已导出');
    } catch (err) {
      showMessage('导出失败');
    }
  }, []);

  // 删除方案
  const handleDeleteScheme = useCallback(async (schemeId) => {
    if (!confirm('确定要删除这个方案吗？')) return;

    try {
      const result = await schemesApi.deleteScheme(schemeId);
      if (result.success) {
        setSchemes((prev) => prev.filter((s) => s.id !== schemeId));
        showMessage('方案已删除');
      }
    } catch (err) {
      showMessage('删除失败');
    }
  }, []);

  // 保存方案成功回调
  const handleSaveSuccess = useCallback((newScheme) => {
    setShowSaveModal(false);
    setSchemes((prev) => [...prev, newScheme]);
    showMessage('方案已保存');
  }, []);

  // 显示消息
  const showMessage = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3000);
  };

  // 过滤后的方案
  const filteredSchemes = schemes.filter((scheme) => {
    if (filter === 'all') return true;
    if (filter === 'preset') return scheme.isPreset;
    if (filter === 'common') return !scheme.isPreset;
    return true;
  });

  return (
    <div className={styles.container}>
      {/* 顶部导航栏 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/" className={styles.backBtn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            返回
          </Link>
          <h1 className={styles.title}>水印方案管理</h1>
        </div>

        <div className={styles.headerRight}>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            导入方案
          </button>
          <button className="btn btn-primary" onClick={() => setShowSaveModal(true)}>
            新建方案
          </button>
        </div>
      </header>

      {/* 消息提示 */}
      {actionMessage && <div className={styles.message}>{actionMessage}</div>}

      {/* 主内容区 */}
      <main className={styles.main}>
        {/* 筛选标签 */}
        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'preset' ? styles.active : ''}`}
            onClick={() => setFilter('preset')}
          >
            预设方案
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'common' ? styles.active : ''}`}
            onClick={() => setFilter('common')}
          >
            普通方案
          </button>
        </div>

        {/* 方案列表 */}
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>加载中...</p>
          </div>
        ) : filteredSchemes.length === 0 ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6M12 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>暂无方案</p>
            <p className={styles.hint}>点击"新建方案"创建第一个水印方案</p>
          </div>
        ) : (
          <div className={styles.schemeList}>
            {filteredSchemes.map((scheme) => (
              <div key={scheme.id} className={styles.schemeCard}>
                <div className={styles.schemeHeader}>
                  <span className={styles.schemeName}>{scheme.name}</span>
                  {scheme.isPreset && <span className={styles.presetBadge}>预设</span>}
                </div>

                <div className={styles.schemePreview}>
                  <span className={styles.previewText} style={{ color: scheme.watermark?.color }}>
                    {scheme.watermark?.text || '水印文字'}
                  </span>
                </div>

                <div className={styles.schemeMeta}>
                  <span>
                    {scheme.watermark?.font || '微软雅黑'} · {scheme.watermark?.scale || 0.5 * 100}%
                  </span>
                  <span>{formatDate(scheme.createdAt)}</span>
                </div>

                <div className={styles.schemeActions}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleLoadScheme(scheme.id)}
                  >
                    加载
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleExportScheme(scheme.id)}
                  >
                    导出
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteScheme(scheme.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 保存方案弹窗 */}
      {showSaveModal && (
        <SchemeSaveModal
          watermark={watermark}
          onSave={handleSaveSuccess}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* 导入方案弹窗 */}
      {showImportModal && (
        <SchemeImportModal
          onImport={(scheme) => {
            setShowImportModal(false);
            setSchemes((prev) => [...prev, scheme]);
            showMessage('方案已导入');
          }}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}

// 格式化日期
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
