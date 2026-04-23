import { useState, useEffect, useCallback, useRef } from 'react';
import useAppStore from '../../stores/appStore';
import FontSelector from './FontSelector';
import styles from './PropertyPanel.module.css';

/**
 * 属性面板组件
 * X/Y/Scale/Rotation/Opacity输入框，字体/颜色选择，实时同步
 */
export default function PropertyPanel({ onSave, onApply }) {
  const { watermark, setWatermark, fonts = [] } = useAppStore();
  const [localValues, setLocalValues] = useState({ ...watermark });
  // 跟踪当前正在编辑的字段，避免在编辑时触发同步
  const editingFieldRef = useRef(null);

  // 同步外部水印值到本地（仅当不在编辑该字段时）
  useEffect(() => {
    if (editingFieldRef.current === null) {
      setLocalValues({ ...watermark });
    }
  }, [watermark]);

  // 处理输入变化
  const handleChange = useCallback((field, value) => {
    // 如果是数字字段且值是字符串，允许部分输入
    if (typeof value === 'string' && ['scale', 'opacity', 'x', 'y', 'rotation'].includes(field)) {
      // 允许输入空字符串或部分输入（如 "0." 或 "0.0" 或 "-"）
      if (value === '' || value === '-' || value === '.' || value === '-.') {
        setLocalValues((prev) => ({ ...prev, [field]: value }));
        return;
      }
      // 检查是否是有效数字
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        return; // 无效输入，不更新
      }
      value = parsed;
    }

    const newValue = { ...localValues, [field]: value };
    setLocalValues(newValue);
    setWatermark({ [field]: value });
  }, [localValues, setWatermark]);

  // 处理输入框聚焦
  const handleFocus = useCallback((field) => {
    editingFieldRef.current = field;
  }, []);

  // 处理数字输入失焦（确保值在有效范围内）
  const handleBlur = useCallback((field) => {
    editingFieldRef.current = null;

    let value = localValues[field];

    switch (field) {
      case 'x':
      case 'y':
      case 'scale':
      case 'opacity':
        value = Math.max(0, Math.min(1, parseFloat(value) || 0));
        break;
      case 'rotation':
        value = ((parseFloat(value) || 0) % 360 + 360) % 360;
        break;
      default:
        break;
    }

    setLocalValues((prev) => ({ ...prev, [field]: value }));
    setWatermark({ [field]: value });
  }, [localValues, setWatermark]);

  // 处理文字输入
  const handleTextChange = (e) => {
    handleChange('text', e.target.value);
  };

  // 处理字体选择
  const handleFontChange = (fontName) => {
    handleChange('font', fontName);
  };

  // 处理颜色选择
  const handleColorChange = (e) => {
    handleChange('color', e.target.value);
  };

  // 可用的字体列表
  const fontList = fonts.length > 0 ? fonts : [
    { name: '微软雅黑', family: 'Microsoft YaHei' },
    { name: '黑体', family: 'SimHei' },
    { name: '宋体', family: 'SimSun' },
    { name: '楷体', family: 'KaiTi' },
  ];

  // 预览文字
  const previewText = localValues.text || '水印预览';

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>水印属性</h3>

      {/* 水印文字 */}
      <div className={styles.section}>
        <label className={styles.label}>水印文字</label>
        <textarea
          className={styles.textarea}
          value={localValues.text || ''}
          onChange={handleTextChange}
          placeholder="请输入水印文字"
          rows={2}
        />
      </div>

      {/* 位置 */}
      <div className={styles.section}>
        <label className={styles.label}>位置</label>
        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <span className={styles.inputLabel}>X</span>
            <input
              type="number"
              className={styles.numberInput}
              value={localValues.x ?? 0.5}
              onChange={(e) => handleChange('x', e.target.value)}
              onFocus={() => handleFocus('x')}
              onBlur={() => handleBlur('x')}
              min={0}
              max={1}
              step={0.001}
            />
          </div>
          <div className={styles.inputGroup}>
            <span className={styles.inputLabel}>Y</span>
            <input
              type="number"
              className={styles.numberInput}
              value={localValues.y ?? 0.5}
              onChange={(e) => handleChange('y', e.target.value)}
              onFocus={() => handleFocus('y')}
              onBlur={() => handleBlur('y')}
              min={0}
              max={1}
              step={0.001}
            />
          </div>
        </div>
        <p className={styles.hint}>相对值 (0-1)</p>
      </div>

      {/* 缩放 */}
      <div className={styles.section}>
        <label className={styles.label}>缩放</label>
        <div className={styles.inputGroup}>
          <input
            type="range"
            className={styles.rangeInput}
            value={localValues.scale || 0.05}
            onChange={(e) => handleChange('scale', parseFloat(e.target.value))}
            min={0.001}
            max={1}
            step={0.001}
          />
          <input
            type="number"
            className={styles.numberInputSmall}
            value={localValues.scale ?? 0.05}
            onChange={(e) => handleChange('scale', e.target.value)}
            onFocus={() => handleFocus('scale')}
            onBlur={() => handleBlur('scale')}
            min={0.001}
            max={1}
            step={0.001}
          />
        </div>
        <p className={styles.hint}>1.0 = 铺满背景宽度</p>
      </div>

      {/* 旋转 */}
      <div className={styles.section}>
        <label className={styles.label}>旋转角度</label>
        <div className={styles.inputGroup}>
          <input
            type="range"
            className={styles.rangeInput}
            value={localValues.rotation || 0}
            onChange={(e) => handleChange('rotation', parseFloat(e.target.value))}
            min={0}
            max={360}
            step={1}
          />
          <input
            type="number"
            className={styles.numberInputSmall}
            value={localValues.rotation ?? 0}
            onChange={(e) => handleChange('rotation', e.target.value)}
            onFocus={() => handleFocus('rotation')}
            onBlur={() => handleBlur('rotation')}
            min={0}
            max={360}
            step={1}
          />
          <span className={styles.unit}>°</span>
        </div>
      </div>

      {/* 透明度 */}
      <div className={styles.section}>
        <label className={styles.label}>透明度</label>
        <div className={styles.inputGroup}>
          <input
            type="range"
            className={styles.rangeInput}
            value={localValues.opacity ?? 1}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
            min={0}
            max={1}
            step={0.01}
          />
          <input
            type="number"
            className={styles.numberInputSmall}
            value={localValues.opacity ?? 0.8}
            onChange={(e) => handleChange('opacity', e.target.value)}
            onFocus={() => handleFocus('opacity')}
            onBlur={() => handleBlur('opacity')}
            min={0}
            max={1}
            step={0.01}
          />
        </div>
      </div>

      {/* 字体 */}
      <div className={styles.section}>
        <label className={styles.label}>字体</label>
        <FontSelector
          value={localValues.font || '微软雅黑'}
          onChange={handleFontChange}
          fontList={fontList}
        />
        {/* 字体预览 */}
        <div className={styles.fontPreview}>
          <span
            className={styles.fontPreviewText}
            style={{
              fontFamily: `"${localValues.font}", sans-serif`,
              color: localValues.color || '#000000',
              opacity: localValues.opacity ?? 1,
            }}
          >
            {previewText}
          </span>
        </div>
      </div>

      {/* 颜色 */}
      <div className={styles.section}>
        <label className={styles.label}>颜色</label>
        <div className={styles.colorInput}>
          <input
            type="color"
            className={styles.colorPicker}
            value={localValues.color || '#000000'}
            onChange={handleColorChange}
          />
          <input
            type="text"
            className={styles.colorText}
            value={localValues.color || '#000000'}
            onChange={(e) => handleChange('color', e.target.value)}
            onBlur={() => handleBlur('color')}
            pattern="^#[0-9A-Fa-f]{6}$"
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className={styles.actions}>
        {onApply && (
          <button className="btn btn-primary btn-sm" onClick={onApply}>
            应用水印
          </button>
        )}
        {onSave && (
          <button className="btn btn-secondary btn-sm" onClick={onSave}>
            保存方案
          </button>
        )}
      </div>
    </div>
  );
}
