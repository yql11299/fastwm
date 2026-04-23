import { useState, useRef, useEffect } from 'react';
import styles from './FontSelector.module.css';

/**
 * 字体选择器组件
 * 使用 div 模拟下拉列表，让每个选项用实际字体渲染
 */
export default function FontSelector({ value, onChange, fontList }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // 获取当前选中的字体
  const selectedFont = fontList.find((f) => f.name === value) || fontList[0];

  // 点击外部关闭下拉列表
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 处理选择
  const handleSelect = (font) => {
    onChange(font.name);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {/* 当前选中的值（触发按钮） */}
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        style={{ fontFamily: selectedFont?.family }}
      >
        <span className={styles.triggerText}>{selectedFont?.name || '选择字体'}</span>
        <span className={styles.arrow}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* 下拉列表 */}
      {isOpen && (
        <div className={styles.dropdown}>
          {fontList.map((font) => (
            <div
              key={font.name}
              className={`${styles.option} ${font.name === value ? styles.selected : ''}`}
              onClick={() => handleSelect(font)}
              style={{ fontFamily: font.family }}
            >
              {font.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
