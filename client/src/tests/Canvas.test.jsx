import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Canvas from '../components/canvas/Canvas';

// Mock dependencies
vi.mock('../hooks/useCanvas', () => ({
  useCanvas: () => ({
    isDragging: false,
    isResizing: false,
    isRotating: false,
    selectedHandle: null,
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleMouseUp: vi.fn(),
  }),
}));

vi.mock('../stores/appStore', () => {
  const state = {
    watermark: {
      text: '仅供XX业务使用',
      x: 0.5,
      y: 0.5,
      scale: 0.5,
      rotation: 0,
      opacity: 0.8,
      font: '微软雅黑',
      color: '#808080',
    },
    canvasBackground: null,
    canvasSize: { width: 800, height: 600 },
    setCanvasSize: vi.fn(),
    setWatermark: vi.fn(),
    setCurrentScheme: vi.fn(),
  };
  return {
    __esModule: true,
    default: () => state,
  };
});

vi.mock('../utils/watermarkRenderer', () => ({
  drawWatermarkOnCanvas: vi.fn(),
  fetchTextPaths: vi.fn().mockResolvedValue({
    success: true,
    data: {
      paths: [],
      totalWidth: 200,
      width: 200,
      height: 100,
    },
  }),
}));

vi.mock('../utils/pdfRenderer', () => ({
  renderPdfBufferToCanvas: vi.fn().mockResolvedValue({
    canvas: {},
    width: 595,
    height: 842,
  }),
}));

vi.mock('../components/canvas/TransformHandles', () => ({
  __esModule: true,
  default: vi.fn(() => null),
}));

vi.mock('../components/canvas/BackgroundUpload', () => ({
  __esModule: true,
  default: vi.fn(() => null),
}));

vi.mock('../api/client', () => ({
  schemesApi: {
    getSchemes: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

const renderCanvas = () => {
  return render(
    <BrowserRouter>
      <Canvas />
    </BrowserRouter>
  );
};

describe('Canvas Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders canvas wrapper', async () => {
    await act(async () => {
      renderCanvas();
    });
    const container = document.querySelector('[class*="canvasWrapper"]');
    expect(container).toBeTruthy();
  });

  it('renders watermark canvas element', async () => {
    await act(async () => {
      renderCanvas();
    });
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('renders SVG overlay for transform handles', async () => {
    await act(async () => {
      renderCanvas();
    });
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders header with back button and title', async () => {
    await act(async () => {
      renderCanvas();
    });
    expect(screen.getByText('返回')).toBeTruthy();
    expect(screen.getByText('水印方案编辑器')).toBeTruthy();
  });

  it('renders header action buttons', async () => {
    await act(async () => {
      renderCanvas();
    });
    const buttons = document.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map(b => b.textContent);
    expect(buttonTexts.some(t => t.includes('打开方案'))).toBe(true);
    expect(buttonTexts.some(t => t.includes('保存方案'))).toBe(true);
    expect(buttonTexts.some(t => t.includes('设为预设'))).toBe(true);
  });

  it('canvas handles mouse down event', async () => {
    await act(async () => {
      renderCanvas();
    });
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();

    await act(async () => {
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 0 });
    });
  });
});
