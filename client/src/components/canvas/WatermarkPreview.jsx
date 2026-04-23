import { memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = '/api/fonts';

/**
 * 水印预览组件
 * 使用 SVG Path 绘制水印，而非文本附加
 *
 * 安全要求：必须将文字转换为 SVG 图形，不可使用文本附加
 *
 * Scale 语义：scale = 1.0 表示水印文本宽度等于背景宽度（未旋转时）
 */
function WatermarkPreview({
  x = 0,
  y = 0,
  scale = 0.5,
  rotation = 0,
  opacity = 1,
  text = '水印文字',
  font = '微软雅黑',
  color = '#000000',
  canvasWidth = 800,
  canvasHeight = 600,
  onDragStart,
}) {
  // 存储文字的路径数据
  const [pathData, setPathData] = useState(null);
  // 加载状态
  const [loading, setLoading] = useState(false);
  // 错误状态
  const [error, setError] = useState(null);
  const prevScaleRef = useRef(scale);

  // 将文字转换为路径
  const fetchTextPaths = useCallback(async () => {
    if (!text || text.length === 0) {
      setPathData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE}/text-to-path`, {
        text,
        fontName: font,
        fontSize: 1000, // 固定字号，让后端返回归一化坐标
      });

      if (response.data.success) {
        setPathData(response.data.data);
      } else {
        setError(response.data.error?.message || '获取路径数据失败');
        setPathData(null);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || err.message || '网络错误';
      setError(errorMessage);
      setPathData(null);
    } finally {
      setLoading(false);
    }
  }, [text, font]);

  // 当文字或字体改变时，重新获取路径数据
  useEffect(() => {
    // 只有文字或字体改变时才重新获取
    if (text !== prevScaleRef.current.text || font !== prevScaleRef.current.font) {
      fetchTextPaths();
      prevScaleRef.current = { text, font, scale };
    }
  }, [text, font, fetchTextPaths]);

  // 初始加载
  useEffect(() => {
    fetchTextPaths();
  }, []);

  // 计算水印实际宽度：scale=1.0 时等于背景宽度
  const watermarkWidth = canvasWidth * scale;
  const watermarkHeight = canvasHeight * scale * 0.15; // 高度按比例估算

  // 旋转中心点（水印中心）
  const rotationCenterX = x;
  const rotationCenterY = y;

  // SVG 变换字符串
  const transform = useMemo(() => {
    return `rotate(${rotation}, ${rotationCenterX}, ${rotationCenterY})`;
  }, [rotation, rotationCenterX, rotationCenterY]);

  // 计算缩放因子：将 path 坐标缩放到目标宽度
  // pathData.totalWidth 是 fontSize=1000 时的文本总宽度
  const scaleFactor = useMemo(() => {
    if (!pathData || pathData.totalWidth === 0) {
      return 1;
    }
    // scale=1.0 时，目标宽度 = canvasWidth
    // 所以 scaleFactor = canvasWidth / pathData.totalWidth
    return canvasWidth / pathData.totalWidth;
  }, [pathData, canvasWidth]);

  // 应用用户指定的 scale 后的实际缩放因子
  // scaleFactor * scale 的效果：
  // - scale=1.0 时，水印宽度 = canvasWidth（满屏）
  // - scale=0.5 时，水印宽度 = canvasWidth * 0.5
  const finalScaleFactor = scaleFactor * scale;

  // 渲染 SVG Path 水印
  const renderPathWatermark = useCallback(() => {
    if (!pathData || !pathData.paths || pathData.paths.length === 0) {
      return null;
    }

    return pathData.paths.map((charPath, index) => {
      // 缩放后的 X 偏移（字符在 fontSize=1000 坐标系中的 x）
      const scaledX = charPath.x * finalScaleFactor;
      // 计算 Y 偏移（基于 baseline）
      const svgHeight = pathData.totalHeight * finalScaleFactor;
      const baselineOffset = pathData.baseline * finalScaleFactor;
      const yOffset = svgHeight - baselineOffset + (charPath.yMin || 0) * finalScaleFactor;

      return (
        <path
          key={index}
          d={charPath.pathData}
          fill={color}
          opacity={opacity}
          transform={`translate(${scaledX}, ${yOffset}) scale(${finalScaleFactor})`}
        />
      );
    });
  }, [pathData, finalScaleFactor, color, opacity]);

  const handleMouseDown = (e) => {
    e.stopPropagation();
    if (onDragStart) {
      onDragStart(e);
    }
  };

  // 加载中或出错时，显示简单的文字水印作为降级
  const isPathVisible = !loading && !error && pathData && pathData.paths && pathData.paths.length > 0;

  // 计算文字的视觉中心偏移（让文字中心对齐到 x, y 点）
  const textOffsetY = useMemo(() => {
    if (!pathData) return 0;
    // baseline 偏移量，用于垂直居中
    return (pathData.totalHeight / 2 - pathData.baseline) * finalScaleFactor;
  }, [pathData, finalScaleFactor]);

  return (
    <g
      className="watermark-preview"
      onMouseDown={handleMouseDown}
      style={{ cursor: 'move' }}
    >
      {/* SVG Path 版本的水印 */}
      {isPathVisible && (
        <g transform={transform}>
          {/* 文字组 - 垂直居中偏移 */}
          <g transform={`translate(0, ${textOffsetY})`}>
            {renderPathWatermark()}
          </g>
        </g>
      )}

      {/* 降级显示：当 API 不可用时 */}
      {!isPathVisible && !loading && (
        <g transform={transform}>
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: font,
              fontSize: `${Math.max(20 * scale, 8)}px`,
              fill: color,
              opacity: opacity * 0.5,
              cursor: 'move',
              userSelect: 'none',
            }}
          >
            {text}
          </text>
        </g>
      )}
    </g>
  );
}

export default memo(WatermarkPreview);
