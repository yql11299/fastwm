// Vitest 测试设置文件
import { expect, vi } from 'vitest';
import '@testing-library/jest-dom';

// 全局 mocks
global.fetch = vi.fn();

// 模拟 ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// 模拟 FileReader
class MockFileReader {
  constructor() {
    this.result = null;
    this.error = null;
    this.onload = null;
    this.onerror = null;
  }

  readAsDataURL(file) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: 'data:image/png;base64,mock' } });
      }
    }, 0);
  }

  readAsText(file) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: '{}' } });
      }
    }, 0);
  }
}

global.FileReader = MockFileReader;

// 模拟 URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// 模拟 Canvas 2D Context
const mockCanvasContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  fill: vi.fn(),
  stroke: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  transform: vi.fn(),
  setTransform: vi.fn(),
  createPath2D: vi.fn(() => ({})),
  drawImage: vi.fn(),
  putImageData: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  createImageData: vi.fn(),
  rect: vi.fn(),
  ellipse: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  isPointInPath: vi.fn(() => false),
  isPointInStroke: vi.fn(() => false),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createPattern: vi.fn(),
  filter: '',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high',
  lineCap: 'butt',
  lineDashOffset: 0,
  lineJoin: 'miter',
  lineWidth: 1,
  miterLimit: 10,
  shadowBlur: 0,
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  textAlign: 'start',
  textBaseline: 'alphabetic',
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext);
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  callback(new Blob(['mock'], { type: 'image/png' }));
});
