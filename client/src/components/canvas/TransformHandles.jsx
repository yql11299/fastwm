import { memo, useMemo } from 'react';
import styles from './TransformHandles.module.css';

/**
 * 变换手柄组件
 * 四角缩放手柄 + 顶部旋转手柄
 * 手柄视觉上跟随水印旋转，但事件处理在原始坐标空间进行
 */
function TransformHandles({
  x = 0,
  y = 0,
  scale = 0.5,
  rotation = 0,
  canvasWidth = 800,
  canvasHeight = 600,
  watermarkWidth = 0,
  watermarkHeight = 0,
  onResizeStart,
  onRotateStart,
  isDragging = false,
  isResizing = false,
  isRotating = false,
  selectedHandle = null,
}) {
  // 如果有实际的 watermarkSize（基于 pathData 计算），使用实际尺寸
  // 否则回退到基于 scale 的估算：scale=1.0 时宽度等于画布宽度，高度按宽高比 2:1 估算
  const aspectRatio = 2;
  const actualWidth = watermarkWidth > 0 ? watermarkWidth : canvasWidth * scale;
  const actualHeight = watermarkHeight > 0 ? watermarkHeight : (canvasWidth * scale) / aspectRatio;

  // 手柄大小
  const handleSize = 12;
  const rotateHandleSize = 14;

  // 将点绕中心旋转（用于计算旋转后的手柄位置）
  const rotatePoint = (px, py, cx, cy, angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  };

  // 计算四角手柄位置（旋转后）
  const corners = useMemo(() => {
    const hw = actualWidth / 2;
    const hh = actualHeight / 2;
    // 原始（未旋转）位置
    const rawCorners = [
      { id: 'nw', ox: x - hw, oy: y - hh, cursor: 'nwse-resize' },
      { id: 'ne', ox: x + hw, oy: y - hh, cursor: 'nesw-resize' },
      { id: 'se', ox: x + hw, oy: y + hh, cursor: 'nwse-resize' },
      { id: 'sw', ox: x - hw, oy: y + hh, cursor: 'nesw-resize' },
    ];
    // 旋转后的位置
    return rawCorners.map((c) => {
      const rotated = rotatePoint(c.ox, c.oy, x, y, rotation);
      return { ...c, x: rotated.x, y: rotated.y };
    });
  }, [x, y, actualWidth, actualHeight, rotation]);

  // 计算旋转后的四个角点（用于绘制旋转后的选择框）
  const rotatedCorners = useMemo(() => {
    const hw = actualWidth / 2;
    const hh = actualHeight / 2;
    // 四个角的位置（旋转后）
    return [
      { x: x - hw, y: y - hh },
      { x: x + hw, y: y - hh },
      { x: x + hw, y: y + hh },
      { x: x - hw, y: y + hh },
    ].map((p) => rotatePoint(p.x, p.y, x, y, rotation));
  }, [x, y, actualWidth, actualHeight, rotation]);

  // 旋转手柄位置（旋转后）
  const rotateHandle = useMemo(() => {
    const rotateOffset = actualHeight / 2 + 30;
    return rotatePoint(x, y - rotateOffset, x, y, rotation);
  }, [x, y, actualHeight, rotation]);

  // 旋转线起点和终点（旋转后）
  const rotateLine = useMemo(() => {
    const lineStart = actualHeight / 2 + 5;
    const lineEnd = actualHeight / 2 + 25;
    const start = rotatePoint(x, y + lineStart, x, y, rotation);
    const end = rotatePoint(x, y + lineEnd, x, y, rotation);
    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }, [x, y, actualHeight, rotation]);

  // 处理手柄点击
  const handleMouseDown = (handleId, e) => {
    e.stopPropagation();
    if (onResizeStart) {
      onResizeStart(handleId, e);
    }
  };

  // 处理旋转点击
  const handleRotateMouseDown = (e) => {
    e.stopPropagation();
    if (onRotateStart) {
      onRotateStart(e);
    }
  };

  // 手柄是否激活
  const isActive = isDragging || isResizing || isRotating;

  return (
    <g
      className={`transform-handles ${isActive ? styles.active : ''}`}
    >
      {/* 选择框（旋转后的实际矩形，使用 polygon） */}
      <polygon
        points={rotatedCorners.map((c) => `${c.x},${c.y}`).join(' ')}
        fill="none"
        stroke="#2563eb"
        strokeWidth="1.5"
        strokeDasharray={isActive ? 'none' : '6 3'}
        pointerEvents="none"
      />

      {/* 旋转线 */}
      <line
        x1={rotateLine.x1}
        y1={rotateLine.y1}
        x2={rotateLine.x2}
        y2={rotateLine.y2}
        stroke="#2563eb"
        strokeWidth="1.5"
        pointerEvents="none"
      />

      {/* 旋转手柄 - 圆形，带十字图标 */}
      <g
        onMouseDown={handleRotateMouseDown}
        style={{ cursor: 'grab', pointerEvents: 'auto' }}
        className={styles.rotateHandle}
      >
        <circle
          cx={rotateHandle.x}
          cy={rotateHandle.y}
          r={rotateHandleSize / 2}
          fill="#fff"
          stroke="#2563eb"
          strokeWidth="2"
        />
        {/* 旋转图标（跟随手柄旋转） */}
        <path
          d={`M ${rotateHandle.x - 3} ${rotateHandle.y} Q ${rotateHandle.x - 3} ${rotateHandle.y - 4} ${rotateHandle.x} ${rotateHandle.y - 4} Q ${rotateHandle.x + 3} ${rotateHandle.y - 4} ${rotateHandle.x + 3} ${rotateHandle.y}`}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d={`M ${rotateHandle.x + 3} ${rotateHandle.y} Q ${rotateHandle.x + 3} ${rotateHandle.y + 4} ${rotateHandle.x} ${rotateHandle.y + 4} Q ${rotateHandle.x - 3} ${rotateHandle.y + 4} ${rotateHandle.x - 3} ${rotateHandle.y}`}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      {/* 四角缩放手柄 */}
      {corners.map((corner) => (
        <rect
          key={corner.id}
          x={corner.x - handleSize / 2}
          y={corner.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#fff"
          stroke="#2563eb"
          strokeWidth="2"
          rx="2"
          cursor={corner.cursor}
          onMouseDown={(e) => handleMouseDown(corner.id, e)}
          style={{ pointerEvents: 'auto' }}
          className={`${styles.resizeHandle} ${selectedHandle === corner.id ? styles.selected : ''} ${isResizing && selectedHandle === corner.id ? styles.resizing : ''}`}
        />
      ))}

      {/* 边缘中点手柄（暂时隐藏） */}
      {[
        { id: 'n', x: x, y: y - actualHeight / 2, cursor: 'ns-resize' },
        { id: 's', x: x, y: y + actualHeight / 2, cursor: 'ns-resize' },
        { id: 'e', x: x + actualWidth / 2, y: y, cursor: 'ew-resize' },
        { id: 'w', x: x - actualWidth / 2, y: y, cursor: 'ew-resize' },
      ].map((edge) => {
        const rotatedEdge = rotatePoint(edge.x, edge.y, x, y, rotation);
        return (
          <rect
            key={edge.id}
            x={rotatedEdge.x - 4}
            y={rotatedEdge.y - 4}
            width={8}
            height={8}
            fill="#fff"
            stroke="#2563eb"
            strokeWidth="1.5"
            rx="1"
            cursor={edge.cursor}
            onMouseDown={(e) => handleMouseDown(edge.id, e)}
            className={`${styles.resizeHandle} ${styles.edgeHandle} ${selectedHandle === edge.id ? styles.selected : ''}`}
            style={{ display: 'none' }}
          />
        );
      })}
    </g>
  );
}

export default memo(TransformHandles);
