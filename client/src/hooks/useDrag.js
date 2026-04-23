import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 拖拽 Hook
 * 处理拖拽事件、位置计算、放置逻辑
 *
 * @param {Object} options
 * @param {Function} options.onDragStart - 开始拖拽回调
 * @param {Function} options.onDragMove - 拖拽移动回调
 * @param {Function} options.onDragEnd - 拖拽结束回调
 * @param {Function} options.onDrop - 放置回调
 * @param {boolean} options.enabled - 是否启用拖拽
 */
export function useDrag({
  onDragStart,
  onDragMove,
  onDragEnd,
  onDrop,
  enabled = true,
} = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  // 使用 ref 跟踪拖拽状态，避免闭包问题
  const isDraggingRef = useRef(false);
  const draggedItemRef = useRef(null);
  const dropTargetRef = useRef(null);

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    currentItem: null,
  });

  // 同步 state 和 ref
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    draggedItemRef.current = draggedItem;
  }, [draggedItem]);

  useEffect(() => {
    dropTargetRef.current = dropTarget;
  }, [dropTarget]);

  // 计算两个元素的中心点距离
  const getDistance = useCallback((pos1, pos2) => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // 获取元素相对于容器的位置
  const getElementPosition = useCallback((element, container) => {
    if (!element || !container) return { x: 0, y: 0 };

    const elemRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return {
      x: elemRect.left + elemRect.width / 2 - containerRect.left,
      y: elemRect.top + elemRect.height / 2 - containerRect.top,
    };
  }, []);

  // 开始拖拽
  const handleDragStart = useCallback(
    (e, item, element) => {
      if (!enabled) return;

      const rect = element.getBoundingClientRect();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        currentItem: item,
      };

      // 先更新 ref（同步）
      isDraggingRef.current = true;
      draggedItemRef.current = item;

      // 再更新 state（触发 UI 更新）
      setIsDragging(true);
      setDraggedItem(item);
      setDragPosition({
        x: e.clientX - dragRef.current.offsetX,
        y: e.clientY - dragRef.current.offsetY,
      });

      if (onDragStart) {
        onDragStart(item, { x: e.clientX, y: e.clientY });
      }

      // 添加全局事件监听
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    },
    [enabled, onDragStart]
  );

  // 拖拽移动 - 使用 ref 检查状态以避免闭包问题
  const handleDragMove = useCallback(
    (e) => {
      if (!isDraggingRef.current) return;

      const newX = e.clientX - dragRef.current.offsetX;
      const newY = e.clientY - dragRef.current.offsetY;

      setDragPosition({ x: newX, y: newY });

      if (onDragMove) {
        onDragMove(draggedItemRef.current, { x: e.clientX, y: e.clientY });
      }
    },
    [onDragMove]
  );

  // 触摸移动 - 使用 ref 检查状态以避免闭包问题
  const handleTouchMove = useCallback(
    (e) => {
      if (!isDraggingRef.current || !e.touches[0]) return;

      const touch = e.touches[0];
      const newX = touch.clientX - dragRef.current.offsetX;
      const newY = touch.clientY - dragRef.current.offsetY;

      setDragPosition({ x: newX, y: newY });

      if (onDragMove) {
        onDragMove(draggedItemRef.current, { x: touch.clientX, y: touch.clientY });
      }
    },
    [onDragMove]
  );

  // 结束拖拽 - 使用 ref 检查状态以避免闭包问题
  const handleDragEnd = useCallback(
    (e) => {
      if (!isDraggingRef.current) return;

      const item = draggedItemRef.current;
      const target = dropTargetRef.current;

      if (onDragEnd) {
        onDragEnd(item, target, { x: e.clientX, y: e.clientY });
      }

      // 清理 - 先更新 ref
      isDraggingRef.current = false;
      draggedItemRef.current = null;
      dropTargetRef.current = null;

      // 再更新 state
      setIsDragging(false);
      setDraggedItem(null);
      setDropTarget(null);

      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    },
    [onDragEnd]
  );

  // 触摸结束 - 使用 ref 检查状态以避免闭包问题
  const handleTouchEnd = useCallback(
    (e) => {
      if (!isDraggingRef.current) return;

      const touch = e.changedTouches[0];
      const item = draggedItemRef.current;
      const target = dropTargetRef.current;

      if (onDragEnd) {
        onDragEnd(item, target, { x: touch.clientX, y: touch.clientY });
      }

      // 清理 - 先更新 ref
      isDraggingRef.current = false;
      draggedItemRef.current = null;
      dropTargetRef.current = null;

      // 再更新 state
      setIsDragging(false);
      setDraggedItem(null);
      setDropTarget(null);

      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    },
    [onDragEnd]
  );

  // 注册拖放区域
  const registerDropZone = useCallback(
    (zoneId, element, data) => {
      if (!element) return;

      const handleDragOver = (e) => {
        e.preventDefault();
        setDropTarget(zoneId);
      };

      const handleDragLeave = () => {
        setDropTarget(null);
      };

      const handleDrop = (e) => {
        e.preventDefault();
        if (onDrop) {
          onDrop(draggedItem, zoneId, data);
        }
      };

      element.addEventListener('dragover', handleDragOver);
      element.addEventListener('dragleave', handleDragLeave);
      element.addEventListener('drop', handleDrop);

      return () => {
        element.removeEventListener('dragover', handleDragOver);
        element.removeEventListener('dragleave', handleDragLeave);
        element.removeEventListener('drop', handleDrop);
      };
    },
    [draggedItem, onDrop]
  );

  // 计算插入位置（基于鼠标位置和元素列表）
  const calculateInsertIndex = useCallback(
    (items, mousePosition, containerRef, getItemPosition) => {
      if (!items || items.length === 0) return 0;

      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return items.length;

      const relativeMouseY = mousePosition.y - containerRect.top;
      const relativeMouseX = mousePosition.x - containerRect.left;

      // 找到最近的位置
      let closestIndex = 0;
      let closestDistance = Infinity;

      items.forEach((item, index) => {
        const itemPos = getItemPosition(item, index, containerRef);
        const distance = Math.sqrt(
          Math.pow(relativeMouseX - itemPos.x, 2) + Math.pow(relativeMouseY - itemPos.y, 2)
        );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      return closestIndex;
    },
    []
  );

  // 清理事件监听 - 使用 ref 确保始终移除最新的监听器
  useEffect(() => {
    return () => {
      // 清理所有可能的监听器
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return {
    isDragging,
    draggedItem,
    dropTarget,
    dragPosition,
    handleDragStart,
    registerDropZone,
    calculateInsertIndex,
    setDropTarget,
  };
}
