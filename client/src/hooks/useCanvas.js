import { useState, useCallback, useRef } from 'react';
import useAppStore from '../stores/appStore';

/**
 * 画布交互 Hook
 * 处理拖拽/缩放/旋转逻辑，属性同步
 *
 * Scale 语义：scale = 1.0 表示水印文本宽度等于背景宽度（未旋转时）
 */
export function useCanvas() {
  const { watermark, setWatermark, canvasSize } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [selectedHandle, setSelectedHandle] = useState(null);

  const dragStart = useRef({
    x: 0,
    y: 0,
    watermarkX: 0,
    watermarkY: 0,
    scale: 0,
    rotation: 0,
    handleId: null,
  });

  // 开始拖拽移动
  const handleMouseDown = useCallback(
    (mode, position, handleId) => {
      dragStart.current = {
        x: position.x,
        y: position.y,
        watermarkX: watermark.x,
        watermarkY: watermark.y,
        scale: watermark.scale,
        rotation: watermark.rotation,
        handleId,
      };

      switch (mode) {
        case 'move':
          setIsDragging(true);
          setIsResizing(false);
          setIsRotating(false);
          break;
        case 'resize':
          setIsDragging(false);
          setIsResizing(true);
          setIsRotating(false);
          setSelectedHandle(handleId);
          break;
        case 'rotate':
          setIsDragging(false);
          setIsResizing(false);
          setIsRotating(true);
          break;
        default:
          break;
      }
    },
    [watermark]
  );

  // 处理鼠标移动
  const handleMouseMove = useCallback(
    (position) => {
      const start = dragStart.current;
      const { x: startX, y: startY } = start;

      if (isDragging) {
        // 拖拽移动：更新 x, y（相对值）
        const deltaX = position.x - startX;
        const deltaY = position.y - startY;
        const relativeDeltaX = deltaX / canvasSize.width;
        const relativeDeltaY = deltaY / canvasSize.height;

        const newX = Math.max(0, Math.min(1, start.watermarkX + relativeDeltaX));
        const newY = Math.max(0, Math.min(1, start.watermarkY + relativeDeltaY));

        setWatermark({ x: newX, y: newY });
      } else if (isResizing) {
        // 缩放：考虑旋转角度，将鼠标位置转换到水印局部坐标系计算
        const centerX = canvasSize.width * start.watermarkX;
        const centerY = canvasSize.height * start.watermarkY;

        // 将鼠标位置转换到水印的局部坐标系（撤销旋转）
        const rotation = start.rotation * Math.PI / 180;
        const dx = position.x - centerX;
        const dy = position.y - centerY;
        // 逆时针旋转：x' = x*cos + y*sin, y' = -x*sin + y*cos
        const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation);
        const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);

        // 初始状态在局部坐标系的偏移
        const startDx = startX - centerX;
        const startDy = startY - centerY;
        const startLocalX = startDx * Math.cos(rotation) + startDy * Math.sin(rotation);
        const startLocalY = -startDx * Math.sin(rotation) + startDy * Math.cos(rotation);

        // 原始宽度和高度（像素）
        const originalWidth = canvasSize.width * start.scale;
        const originalHeight = canvasSize.height * start.scale;

        // 计算相对于原始尺寸的变化
        let newWidth = originalWidth;
        let newHeight = originalHeight;

        switch (selectedHandle) {
          case 'se':
            // 东南手柄：x方向增大width，y方向增大height
            newWidth = Math.max(10, originalWidth / 2 + (localX - startLocalX) * 2);
            newHeight = Math.max(10, originalHeight / 2 + (localY - startLocalY) * 2);
            break;
          case 'nw':
            // 西北手柄：x方向减小width，y方向减小height
            newWidth = Math.max(10, originalWidth / 2 - (localX - startLocalX) * 2);
            newHeight = Math.max(10, originalHeight / 2 - (localY - startLocalY) * 2);
            break;
          case 'ne':
            // 东北手柄：x方向增大width，y方向减小height
            newWidth = Math.max(10, originalWidth / 2 + (localX - startLocalX) * 2);
            newHeight = Math.max(10, originalHeight / 2 - (localY - startLocalY) * 2);
            break;
          case 'sw':
            // 西南手柄：x方向减小width，y方向增大height
            newWidth = Math.max(10, originalWidth / 2 - (localX - startLocalX) * 2);
            newHeight = Math.max(10, originalHeight / 2 + (localY - startLocalY) * 2);
            break;
          case 'e':
            // 右中手柄：只改变宽度
            newWidth = Math.max(10, originalWidth / 2 + (localX - startLocalX) * 2);
            break;
          case 'w':
            // 左中手柄：只改变宽度
            newWidth = Math.max(10, originalWidth / 2 - (localX - startLocalX) * 2);
            break;
          case 'n':
            // 上中手柄：只改变高度
            newHeight = Math.max(10, originalHeight / 2 - (localY - startLocalY) * 2);
            break;
          case 's':
            // 下中手柄：只改变高度
            newHeight = Math.max(10, originalHeight / 2 + (localY - startLocalY) * 2);
            break;
          default:
            newWidth = originalWidth;
            newHeight = originalHeight;
        }

        // 取宽度和高度的平均值作为新的scale（保持宽高比）
        const avgScale = ((newWidth / canvasSize.width) + (newHeight / canvasSize.height)) / 2;
        const newScale = Math.max(0.001, Math.min(1.0, avgScale));
        setWatermark({ scale: newScale });
      } else if (isRotating) {
        // 旋转：以中心点为圆心计算角度
        const centerX = canvasSize.width * start.watermarkX;
        const centerY = canvasSize.height * start.watermarkY;

        const startAngle = Math.atan2(startY - centerY, startX - centerX);
        const currentAngle = Math.atan2(position.y - centerY, position.x - centerX);
        const deltaAngle = ((currentAngle - startAngle) * 180) / Math.PI;

        // 加上初始旋转角度
        const newRotation = ((start.rotation + deltaAngle) % 360 + 360) % 360;
        setWatermark({ rotation: newRotation });
      }
    },
    [isDragging, isResizing, isRotating, selectedHandle, canvasSize, setWatermark]
  );

  // 处理鼠标释放
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
    setSelectedHandle(null);
    dragStart.current = {
      x: 0,
      y: 0,
      watermarkX: 0,
      watermarkY: 0,
      scale: 0,
      rotation: 0,
      handleId: null,
    };
  }, []);

  // 更新水印属性
  const updateWatermark = useCallback(
    (updates) => {
      setWatermark(updates);
    },
    [setWatermark]
  );

  // 重置水印到默认位置
  const resetWatermarkPosition = useCallback(() => {
    setWatermark({
      x: 0.5,
      y: 0.5,
      scale: 0.5,
      rotation: 0,
    });
  }, [setWatermark]);

  // 水印居中
  const centerWatermark = useCallback(() => {
    setWatermark({
      x: 0.5,
      y: 0.5,
    });
  }, [setWatermark]);

  // 获取当前水印状态摘要
  const getWatermarkState = useCallback(() => {
    return {
      ...watermark,
      isDragging,
      isResizing,
      isRotating,
      selectedHandle,
    };
  }, [watermark, isDragging, isResizing, isRotating, selectedHandle]);

  return {
    // 状态
    isDragging,
    isResizing,
    isRotating,
    selectedHandle,
    dragStart: dragStart.current,

    // 方法
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    updateWatermark,
    resetWatermarkPosition,
    centerWatermark,
    getWatermarkState,
  };
}
