import { useState, useEffect } from 'react';
import { settingsApi } from '../../api/client';
import useAppStore from '../../stores/appStore';
import styles from './SettingsModal.module.css';

export default function SettingsModal({ onClose }) {
  const { settings, setSettings } = useAppStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // 加载远程设置
  useEffect(() => {
    const loadSettings = async () => {
      const result = await settingsApi.getSettings();
      if (result.success && result.data) {
        const loadedSettings = {
          export: result.data.export || settings.export,
          defaultWatermark: result.data.defaultWatermark || settings.defaultWatermark,
        };
        setLocalSettings(loadedSettings);
        setSettings(loadedSettings);
      }
    };
    loadSettings();
  }, [setSettings]);

  const handleExportChange = (field, value) => {
    setLocalSettings({
      ...localSettings,
      export: { ...localSettings.export, [field]: value },
    });
  };

  const handleWatermarkChange = (field, value) => {
    setLocalSettings({
      ...localSettings,
      defaultWatermark: { ...localSettings.defaultWatermark, [field]: value },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await settingsApi.updateSettings(localSettings);
      if (result.success) {
        setSettings(localSettings);
        onClose();
      } else {
        setError('保存失败，请重试');
      }
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>用户设置</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {error && <div className={styles.error}>{error}</div>}

          {/* 导出设置 */}
          <section className={styles.section}>
            <h3>导出设置</h3>
            <div className={styles.field}>
              <label htmlFor="namingRule">文件命名规则</label>
              <select
                id="namingRule"
                value={localSettings.export?.namingRule || 'timestamp_text'}
                onChange={(e) => handleExportChange('namingRule', e.target.value)}
              >
                <option value="original">原名 (身份证.pdf)</option>
                <option value="timestamp">原名_时间戳 (身份证_20260428120000.pdf)</option>
                <option value="text">原名_水印文字 (身份证_仅供内部使用.pdf)</option>
                <option value="timestamp_text">原名_时间戳_水印文字 (身份证_20260428120000_仅供内部使用.pdf)</option>
              </select>
              <span className={styles.hint}>决定导出文件的命名格式</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="quality">导出质量</label>
              <div className={styles.rangeField}>
                <input
                  id="quality"
                  type="range"
                  min="1"
                  max="100"
                  value={localSettings.export?.quality || 100}
                  onChange={(e) => handleExportChange('quality', parseInt(e.target.value))}
                />
                <span className={styles.rangeValue}>{localSettings.export?.quality || 100}%</span>
              </div>
              <span className={styles.hint}>PDF 导出质量 (1-100)</span>
            </div>
          </section>

          {/* 默认水印参数 */}
          <section className={styles.section}>
            <h3>默认水印参数</h3>
            <div className={styles.field}>
              <label htmlFor="wmText">水印文字</label>
              <input
                id="wmText"
                type="text"
                value={localSettings.defaultWatermark?.text || ''}
                onChange={(e) => handleWatermarkChange('text', e.target.value)}
                placeholder="默认水印文字"
              />
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="wmX">X 坐标</label>
                <input
                  id="wmX"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={localSettings.defaultWatermark?.x ?? 0.5}
                  onChange={(e) => handleWatermarkChange('x', parseFloat(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="wmY">Y 坐标</label>
                <input
                  id="wmY"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={localSettings.defaultWatermark?.y ?? 0.5}
                  onChange={(e) => handleWatermarkChange('y', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="wmScale">缩放</label>
                <input
                  id="wmScale"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={localSettings.defaultWatermark?.scale ?? 0.05}
                  onChange={(e) => handleWatermarkChange('scale', parseFloat(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="wmRotation">旋转角度</label>
                <input
                  id="wmRotation"
                  type="number"
                  step="1"
                  min="0"
                  max="360"
                  value={localSettings.defaultWatermark?.rotation ?? 0}
                  onChange={(e) => handleWatermarkChange('rotation', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="wmOpacity">透明度</label>
                <input
                  id="wmOpacity"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={localSettings.defaultWatermark?.opacity ?? 0.8}
                  onChange={(e) => handleWatermarkChange('opacity', parseFloat(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="wmColor">颜色</label>
                <input
                  id="wmColor"
                  type="color"
                  value={localSettings.defaultWatermark?.color || '#808080'}
                  onChange={(e) => handleWatermarkChange('color', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="wmFont">字体</label>
              <select
                id="wmFont"
                value={localSettings.defaultWatermark?.font || '黑体'}
                onChange={(e) => handleWatermarkChange('font', e.target.value)}
              >
                <option value="黑体">黑体</option>
                <option value="楷体">楷体</option>
                <option value="宋体">宋体</option>
                <option value="微软雅黑">微软雅黑</option>
              </select>
              <span className={styles.hint}>仅支持 TTF/OTF 格式字体</span>
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}