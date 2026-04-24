import { useRef, useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCanvas } from '../../hooks/useCanvas';
import TransformHandles from './TransformHandles';
import BackgroundUpload from './BackgroundUpload';
import PropertyPanel from './PropertyPanel';
import useAppStore from '../../stores/appStore';
import { schemesApi, documentsApi, settingsApi, processApi } from '../../api/client';
import { drawWatermarkOnCanvas, fetchTextPaths } from '../../utils/watermarkRenderer';
import { renderPdfBufferToCanvas } from '../../utils/pdfRenderer';
import styles from './Canvas.module.css';

/**
 * 画布组件 - 水印方案编辑器
 * 使用 Canvas 渲染架构，支持 PDF 背景和水印预览
 * 渲染逻辑与后端保持一致
 */
export default function Canvas() {
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const wmCanvasRef = useRef(null);

  const {
    watermark,
    setWatermark,
    canvasSize,
    setCanvasSize,
    canvasBackground,
    setCanvasBackground,
    currentScheme,
    setCurrentScheme,
    setWatermarkSize,
    watermarkSize,
  } = useAppStore();

  const {
    isDragging,
    isResizing,
    isRotating,
    selectedHandle,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useCanvas();

  const [showSchemeList, setShowSchemeList] = useState(false);
  const [schemeList, setSchemeList] = useState([]);
  const [pathData, setPathData] = useState(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [bgError, setBgError] = useState('');
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0); // 用于强制触发水印重渲染
  const prevBackgroundIdRef = useRef(null);
  const [isDragOverBg, setIsDragOverBg] = useState(false);

  // 每次进入画布时，从后端 API 获取默认方案并初始化
  useEffect(() => {
    let cancelled = false;

    const initCanvas = async () => {
      // 1. 从 API 获取默认配置
      const result = await settingsApi.getSettings();
      if (cancelled) return;

      const defaultWatermark = result.success && result.data?.defaultWatermark
        ? result.data.defaultWatermark
        : null;

      console.log('[Canvas] 获取到默认水印配置:', defaultWatermark);

      // 2. 设置配置到 store
      useAppStore.getState().setWatermark(defaultWatermark);
      useAppStore.getState().setWatermarkSize({ width: 0, height: 0 });
      useAppStore.getState().setCurrentScheme(null);

      // 3. 等待一下确保组件已完成首次渲染
      await new Promise(resolve => setTimeout(resolve, 50));

      if (cancelled) return;

      // 4. 标记初始化完成，触发水印渲染
      setCanvasInitialized(true);

      // 5. 再等待一下确保 canvasInitialized 被处理
      await new Promise(resolve => setTimeout(resolve, 50));

      if (cancelled) return;

      // 6. 强制触发一次水印重渲染
      setRenderTrigger(t => t + 1);

      // 7. 直接在 canvas 上绘制水印
      requestAnimationFrame(() => {
        const canvas = wmCanvasRef.current;
        if (canvas && canvas.width > 0 && canvas.height > 0 && defaultWatermark?.text) {
          console.log('[Canvas] initCanvas 直接绘制水印到 Canvas');
          const ctx = canvas.getContext('2d');
          drawWatermarkOnCanvas(ctx, defaultWatermark, canvas.width, canvas.height);
        }
      });
    };
    initCanvas();

    return () => {
      cancelled = true;
    };
  }, []);

  // 从 URL 参数加载背景
  useEffect(() => {
    const backgroundId = searchParams.get('backgroundId');
    const backgroundType = searchParams.get('backgroundType');

    console.log('[Canvas] 背景加载检查:', {
      backgroundId,
      prevBackgroundId: prevBackgroundIdRef.current,
    });

    if (!backgroundId) return;

    // 如果背景 ID 发生变化，清除旧背景重新加载
    if (prevBackgroundIdRef.current !== backgroundId) {
      console.log('[Canvas] 背景ID变化，清除旧背景:', {
        old: prevBackgroundIdRef.current,
        new: backgroundId,
      });
      prevBackgroundIdRef.current = backgroundId;
      setCanvasBackground(null);
      setCanvasSize({ width: 800, height: 600 });
    }

    const loadBackgroundFromServer = async () => {
      setBgLoading(true);
      setBgError('');

      try {
        const result = await documentsApi.getDocumentContent(backgroundId);

        if (!result.success) {
          throw new Error(result.error?.message || '加载背景失败');
        }

        const { content, mimeType, fileName } = result.data;

        if (!content) {
          throw new Error('背景内容为空');
        }

        // 将 base64 转换为 data URL
        const dataUrl = `data:${mimeType};base64,${content}`;

        // 根据文件类型设置背景
        const fileType = backgroundType || (mimeType.includes('pdf') ? 'pdf' : 'image');

        if (fileType === 'pdf') {
          // PDF 文件
          setCanvasBackground({ type: 'pdf', dataUrl, fileName, fileId: backgroundId });
          setCanvasSize({ width: 595, height: 842 }); // 默认 A4 尺寸，后续会更新
        } else {
          // 图片文件
          const img = new Image();
          img.onload = () => {
            setCanvasSize({
              width: img.naturalWidth,
              height: img.naturalHeight,
            });
            setCanvasBackground({ type: 'image', dataUrl, fileName, fileId: backgroundId });
          };
          img.onerror = () => {
            setBgError('图片加载失败');
          };
          img.src = dataUrl;
        }
      } catch (err) {
        console.error('Failed to load background:', err);
        setBgError(err.message || '加载背景失败');
      } finally {
        setBgLoading(false);
      }
    };

    loadBackgroundFromServer();
  }, [searchParams.get('backgroundId'), searchParams.get('backgroundType')]);

  // 加载方案列表
  useEffect(() => {
    const loadSchemes = async () => {
      const result = await schemesApi.getSchemes();
      if (result.success) {
        setSchemeList(result.data || []);
      }
    };
    loadSchemes();
  }, []);

  // 获取文字路径数据
  useEffect(() => {
    if (!watermark.text) {
      console.log('[Canvas] 无水印文字，清空路径数据');
      setPathData(null);
      setWatermarkSize({ width: 0, height: 0 });
      return;
    }

    const loadPathData = async () => {
      try {
        console.log('[Canvas] 开始加载路径数据:', {
          text: watermark.text,
          font: watermark.font || '黑体',
          canvasSize,
        });

        const response = await fetchTextPaths(watermark.text, watermark.font || '黑体');
        // API 返回格式: { success: true, data: { paths, totalWidth, ... } }
        console.log('[Canvas] API 响应:', response);

        if (response.success && response.data && response.data.paths) {
          console.log('[Canvas] 设置路径数据:', {
            pathsCount: response.data.paths.length,
            totalWidth: response.data.totalWidth,
          });
          setPathData(response.data);

          // 计算实际渲染尺寸并存储到 appStore
          // scale=1.0 时宽度等于画布宽度
          const finalScaleFactor = canvasSize.width * watermark.scale / response.data.totalWidth;
          const renderedWidth = response.data.totalWidth * finalScaleFactor;
          const renderedHeight = response.data.totalHeight * finalScaleFactor;
          console.log('[Canvas] 计算水印实际尺寸:', {
            renderedWidth,
            renderedHeight,
            finalScaleFactor,
          });
          setWatermarkSize({ width: renderedWidth, height: renderedHeight });
        } else {
          console.error('[Canvas] API 响应格式错误:', response);
          setPathData(null);
          setWatermarkSize({ width: 0, height: 0 });
        }
      } catch (err) {
        console.error('[Canvas] 加载路径数据失败:', err);
        setPathData(null);
        setWatermarkSize({ width: 0, height: 0 });
      }
    };
    loadPathData();
  }, [watermark.text, watermark.font, canvasSize]);

  // 渲染水印到 Canvas（同步渲染，与 TransformHandles 保持一致）
  useEffect(() => {
    const canvas = wmCanvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      console.log('[Canvas] Canvas 未准备好');
      return;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 从 Zustand 直接获取最新值（避免闭包陷阱）
    const currentWatermark = useAppStore.getState().watermark;

    console.log('[Canvas] 渲染水印:', {
      hasWatermarkText: !!currentWatermark.text,
      canvasWidth: width,
      canvasHeight: height,
      watermark: currentWatermark,
    });

    if (!currentWatermark.text) {
      console.log('[Canvas] 清空水印 Canvas');
      ctx.clearRect(0, 0, width, height);
      setWatermarkSize({ width: 0, height: 0 });
      return;
    }

    // 使用 watermarkRenderer 绘制水印
    drawWatermarkOnCanvas(ctx, currentWatermark, width, height);

    // 测量实际渲染的文本尺寸
    const fontSize = width * currentWatermark.scale;
    ctx.font = `${fontSize}px "${currentWatermark.font || '黑体'}"`;
    const metrics = ctx.measureText(currentWatermark.text);
    const textWidth = metrics.width;
    // 字体高度约为 fontSize 的 1.2 倍
    const textHeight = fontSize * 1.2;

    console.log('[Canvas] 测量文本尺寸:', { textWidth, textHeight, fontSize });
    setWatermarkSize({ width: textWidth, height: textHeight });
  }, [watermark, canvasSize.width, canvasSize.height, canvasInitialized, renderTrigger]);

  // 渲染背景到 bgCanvas
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!canvasBackground) {
      // 没有背景时清空画布
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (canvasBackground.type === 'pdf' && canvasBackground.dataUrl) {
      // PDF: 使用 pdf.js 渲染
      console.log('[Canvas] 开始渲染 PDF 背景');
      renderPdfBufferToCanvas(canvasBackground.dataUrl, 1, 800)  // 使用固定宽度 800px
        .then(({ canvas: pdfCanvas, width: pdfWidth, height: pdfHeight }) => {
          console.log('[Canvas] PDF 渲染成功:', { pdfWidth, pdfHeight });
          if (bgCanvasRef.current) {
            // 先更新 Canvas 尺寸
            bgCanvasRef.current.width = pdfWidth;
            bgCanvasRef.current.height = pdfHeight;
            
            // 再更新状态（这会触发其他 useEffect）
            setCanvasSize({ width: pdfWidth, height: pdfHeight });

            const localCtx = bgCanvasRef.current.getContext('2d');
            if (localCtx) {
              localCtx.clearRect(0, 0, pdfWidth, pdfHeight);
              localCtx.drawImage(pdfCanvas, 0, 0);
            }
          }
        })
        .catch(err => {
          console.error('[Canvas] PDF render error:', err);
          setBgError('PDF 渲染失败: ' + err.message);
        });
    } else if (canvasBackground.type === 'image' && canvasBackground.dataUrl) {
      // 图片
      console.log('[Canvas] 开始渲染图片背景');
      const img = new Image();
      img.onload = () => {
        console.log('[Canvas] 图片加载成功:', { width: img.naturalWidth, height: img.naturalHeight });
        if (bgCanvasRef.current) {
          // 先更新 Canvas 尺寸
          bgCanvasRef.current.width = img.naturalWidth;
          bgCanvasRef.current.height = img.naturalHeight;
          
          // 再更新状态
          setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight });

          const localCtx = bgCanvasRef.current.getContext('2d');
          if (localCtx) {
            localCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
            localCtx.drawImage(img, 0, 0);
          }
        }
      };
      img.onerror = (err) => {
        console.error('[Canvas] Image load error:', err);
        setBgError('图片加载失败');
      };
      img.src = canvasBackground.dataUrl;
    }
  }, [canvasBackground]);  // 移除 canvasSize 依赖，避免循环

  // 同步 Canvas 尺寸
  useEffect(() => {
    if (wmCanvasRef.current && canvasSize.width > 0) {
      wmCanvasRef.current.width = canvasSize.width;
      wmCanvasRef.current.height = canvasSize.height;

      // 强制触发一次水印重绘（确保尺寸设置后渲染）
      requestAnimationFrame(() => {
        const canvas = wmCanvasRef.current;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          const ctx = canvas.getContext('2d');
          const currentWatermark = useAppStore.getState().watermark;
          if (currentWatermark.text) {
            drawWatermarkOnCanvas(ctx, currentWatermark, canvas.width, canvas.height);
          }
        }
      });
    }
  }, [canvasSize]);

  // 计算水印的实际像素位置
  const getWatermarkPosition = useCallback(() => {
    const pixelX = canvasSize.width * watermark.x;
    const pixelY = canvasSize.height * watermark.y;
    return { x: pixelX, y: pixelY };
  }, [canvasSize, watermark.x, watermark.y]);

  // 计算水印的变换
  const getWatermarkTransform = useCallback(() => {
    const pos = getWatermarkPosition();
    return {
      x: pos.x,
      y: pos.y,
      scale: watermark.scale,
      rotation: watermark.rotation,
      opacity: watermark.opacity,
    };
  }, [getWatermarkPosition, watermark.scale, watermark.rotation, watermark.opacity]);

  // 处理水印拖拽
  const onWatermarkDragStart = useCallback(
    (e) => {
      const rect = wmCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      // 计算 CSS 缩放比例，将鼠标位置转换为原始 Canvas 坐标
      const displayScaleX = canvasSize.width / rect.width;
      const displayScaleY = canvasSize.height / rect.height;
      const x = (e.clientX - rect.left) * displayScaleX;
      const y = (e.clientY - rect.top) * displayScaleY;
      handleMouseDown('move', { x, y }, null);
    },
    [handleMouseDown, canvasSize]
  );

  // 处理缩放手柄拖拽
  const onHandleDragStart = useCallback(
    (handleId, e) => {
      e.stopPropagation();
      const rect = wmCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      // 计算 CSS 缩放比例，将鼠标位置转换为原始 Canvas 坐标
      const displayScaleX = canvasSize.width / rect.width;
      const displayScaleY = canvasSize.height / rect.height;
      const x = (e.clientX - rect.left) * displayScaleX;
      const y = (e.clientY - rect.top) * displayScaleY;
      handleMouseDown('resize', { x, y }, handleId);
    },
    [handleMouseDown, canvasSize]
  );

  // 处理旋转手柄拖拽
  const onRotateDragStart = useCallback(
    (e) => {
      e.stopPropagation();
      const rect = wmCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      // 计算 CSS 缩放比例，将鼠标位置转换为原始 Canvas 坐标
      const displayScaleX = canvasSize.width / rect.width;
      const displayScaleY = canvasSize.height / rect.height;
      const x = (e.clientX - rect.left) * displayScaleX;
      const y = (e.clientY - rect.top) * displayScaleY;
      handleMouseDown('rotate', { x, y }, null);
    },
    [handleMouseDown, canvasSize]
  );

  // 全局鼠标移动/抬起
  useEffect(() => {
    if (!isDragging && !isResizing && !isRotating) return;

    const onMouseMove = (e) => {
      const rect = wmCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // 计算 CSS 缩放比例，将鼠标位置转换为原始 Canvas 坐标
      const displayScaleX = canvasSize.width / rect.width;
      const displayScaleY = canvasSize.height / rect.height;
      const x = (e.clientX - rect.left) * displayScaleX;
      const y = (e.clientY - rect.top) * displayScaleY;

      handleMouseMove({ x, y });
    };

    const onMouseUp = () => {
      handleMouseUp();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
};
  }, [isDragging, isResizing, isRotating, handleMouseMove, handleMouseUp, canvasSize]);

  // 防止画布区域的滚轮事件传播到页面
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.stopPropagation();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // 保存方案
  const handleSaveScheme = async () => {
    const name = prompt('请输入方案名称：', currentScheme?.name || '我的方案');
    if (!name) return;

    const schemeData = {
      name,
      isPreset: false,
      watermark: { ...watermark },
    };

    if (currentScheme?.id) {
      await schemesApi.updateScheme(currentScheme.id, schemeData);
    } else {
      const result = await schemesApi.createScheme(schemeData);
      if (result.success && result.data) {
        setCurrentScheme(result.data);
      }
    }
    alert('方案保存成功');
  };

  // 设为预设
  const handleSetPreset = async () => {
    if (!currentScheme?.id) {
      alert('请先保存方案');
      return;
    }
    await schemesApi.updateScheme(currentScheme.id, { isPreset: true });
    alert('已设为预设方案');
  };

  // 应用水印 - 使用当前画布背景和水印参数直接导出
  const handleApplyWatermark = async () => {
    if (!canvasBackground) {
      alert('没有背景文件，请先选择背景');
      return;
    }

    if (!watermark.text) {
      alert('请输入水印文字');
      return;
    }

    // 从 canvasBackground 中获取 fileId
    const currentBackground = useAppStore.getState().canvasBackground;
    if (!currentBackground?.fileId) {
      alert('背景文件信息不完整，请重新选择');
      return;
    }

    try {
      const result = await processApi.processWatermark({
        watermark: watermark,
        fileIds: [currentBackground.fileId],
        exportConfig: {
          namingRule: 'timestamp_text',
          quality: 100,
        },
      });

      if (result.success && result.data?.taskId) {
        if (result.data.status === 'completed') {
          await processApi.downloadResult(result.data.taskId, 'file');
        } else {
          const taskId = result.data.taskId;
          let attempts = 0;
          const maxAttempts = 30;

          while (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const statusResult = await processApi.getStatus(taskId);

            if (statusResult.success && statusResult.data?.status === 'completed') {
              await processApi.downloadResult(taskId, 'file');
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
      console.error('Apply watermark error:', err);
      alert('处理失败，请稍后重试');
    }
  };

  // 加载方案
  const handleLoadScheme = async (scheme) => {
    console.log('[Canvas] handleLoadScheme 开始加载方案:', scheme);

    // 从后端获取方案的完整信息（包含 watermark）
    const result = await schemesApi.getScheme(scheme.id);
    if (!result.success || !result.data) {
      console.error('[Canvas] 获取方案详情失败:', result.error);
      alert('加载方案失败');
      return;
    }

    const fullScheme = result.data;
    console.log('[Canvas] 获取到完整方案:', fullScheme);

    setCurrentScheme(fullScheme);
    if (fullScheme.watermark) {
      console.log('[Canvas] 设置水印:', fullScheme.watermark);
      setWatermark(fullScheme.watermark);

      // 直接在 canvas 上绘制水印（绕过 useEffect 时序问题）
      requestAnimationFrame(() => {
        const canvas = wmCanvasRef.current;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          console.log('[Canvas] 直接绘制水印到 Canvas');
          const ctx = canvas.getContext('2d');
          drawWatermarkOnCanvas(ctx, fullScheme.watermark, canvas.width, canvas.height);

          // 测量并更新尺寸
          const fontSize = canvas.width * fullScheme.watermark.scale;
          ctx.font = `${fontSize}px "${fullScheme.watermark.font || '黑体'}"`;
          const metrics = ctx.measureText(fullScheme.watermark.text);
          setWatermarkSize({ width: metrics.width, height: fontSize * 1.2 });
        } else {
          console.log('[Canvas] Canvas 未准备好，依赖 useEffect 渲染', { canvasWidth: canvas?.width, canvasHeight: canvas?.height });
        }
      });

      // 强制触发水印重渲染
      setRenderTrigger(t => t + 1);
    }
    setShowSchemeList(false);
  };

  // 删除方案
  const handleDeleteScheme = async (schemeId) => {
    if (!confirm('确定要删除这个方案吗？')) return;
    await schemesApi.deleteScheme(schemeId);
    setSchemeList(schemeList.filter(s => s.id !== schemeId));
    if (currentScheme?.id === schemeId) {
      setCurrentScheme(null);
    }
  };

  const transform = getWatermarkTransform();

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
          <h1 className={styles.title}>水印方案编辑器</h1>
          {currentScheme && (
            <span className={styles.currentSchemeName}>当前: {currentScheme.name}</span>
          )}
        </div>

        <div className={styles.headerRight}>
          <button className="btn btn-secondary" onClick={() => setShowSchemeList(true)}>
            打开方案
          </button>
          <button className="btn btn-secondary" onClick={handleSaveScheme}>
            保存方案
          </button>
          <button className="btn btn-primary" onClick={handleSetPreset}>
            设为预设
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className={styles.main}>
        {/* 画布区域 */}
        <div className={styles.canvasArea}>
          {/* 背景上传控制 - 移出画布避免遮挡 */}
          <div className={styles.bgControls}>
            <BackgroundUpload />
            {/* 从服务器加载背景的状态 */}
            {bgLoading && (
              <div className={styles.bgLoadingIndicator}>
                <span className={styles.spinner}></span>
                <span>正在加载背景...</span>
              </div>
            )}
            {bgError && (
              <div className={styles.bgError}>
                <span>{bgError}</span>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setBgError('')}
                >
                  关闭
                </button>
              </div>
            )}
          </div>
          <div
            className={`${styles.canvasWrapper} ${isDragOverBg ? styles.dragOver : ''}`}
            ref={containerRef}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOverBg(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOverBg(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOverBg(false);

              const file = e.dataTransfer.files?.[0];
              if (!file) return;

              // 处理拖拽的本地文件
              const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
              if (!validTypes.includes(file.type)) {
                setBgError('仅支持 JPG、PNG、PDF 文件');
                return;
              }

              // 使用 FileReader 读取文件
              const reader = new FileReader();
              reader.onload = (evt) => {
                const dataUrl = evt.target.result;

                if (file.type === 'application/pdf') {
                  setCanvasBackground({ type: 'pdf', dataUrl, fileName: file.name, fileId: null });
                  setCanvasSize({ width: 595, height: 842 });
                } else {
                  const img = new Image();
                  img.onload = () => {
                    setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight });
                    setCanvasBackground({ type: 'image', dataUrl, fileName: file.name, fileId: null });
                  };
                  img.onerror = () => setBgError('图片加载失败');
                  img.src = dataUrl;
                }
              };
              reader.onerror = () => setBgError('文件读取失败');
              reader.readAsDataURL(file);
            }}
          >
            {/* 背景 Canvas - 使用实际像素尺寸 */}
            <canvas
              ref={bgCanvasRef}
              data-bg-canvas
              className={isDragOverBg ? styles.dragOver : ''}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: canvasSize.width,
                height: canvasSize.height,
                zIndex: 1,
              }}
            />

            {/* 水印 Canvas - 使用实际像素尺寸 */}
            <canvas
              ref={wmCanvasRef}
              data-wm-canvas
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: canvasSize.width,
                height: canvasSize.height,
                zIndex: 2,
                display: 'block',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              onMouseDown={onWatermarkDragStart}
            />

            {/* SVG 手柄层 */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: canvasSize.width,
                height: canvasSize.height,
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >
              <TransformHandles
                x={transform.x}
                y={transform.y}
                scale={watermark.scale}
                rotation={watermark.rotation}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                watermarkWidth={watermarkSize.width}
                watermarkHeight={watermarkSize.height}
                onResizeStart={onHandleDragStart}
                onRotateStart={onRotateDragStart}
                isDragging={isDragging}
                isResizing={isResizing}
                isRotating={isRotating}
                selectedHandle={selectedHandle}
              />
            </svg>

            </div>
        </div>

        {/* 属性面板 */}
        <aside className={styles.sidebar}>
          <PropertyPanel onApply={handleApplyWatermark} />
        </aside>
      </main>

      {/* 方案列表弹窗 */}
      {showSchemeList && (
        <div className={styles.modalOverlay} onClick={() => setShowSchemeList(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>选择方案</h3>
              <button className={styles.closeBtn} onClick={() => setShowSchemeList(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalContent}>
              {schemeList.length === 0 ? (
                <p className={styles.noSchemes}>暂无保存的方案</p>
              ) : (
                <div className={styles.schemeList}>
                  {schemeList.map((scheme) => (
                    <div key={scheme.id} className={styles.schemeItem}>
                      <div className={styles.schemeInfo}>
                        <span className={styles.schemeName}>{scheme.name}</span>
                        {scheme.isPreset && <span className={styles.presetBadge}>预设</span>}
                      </div>
                      <div className={styles.schemeActions}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleLoadScheme(scheme)}
                        >
                          加载
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteScheme(scheme.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}