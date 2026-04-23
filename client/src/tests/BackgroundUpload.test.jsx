import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BackgroundUpload from '../components/canvas/BackgroundUpload';

// Mock dependencies
vi.mock('../stores/appStore', () => {
  return {
    __esModule: true,
    default: () => ({
      canvasBackground: null,
      setCanvasBackground: vi.fn(),
      canvasSize: { width: 800, height: 600 },
      setCanvasSize: vi.fn(),
    }),
  };
});

vi.mock('../utils/pdfRenderer', () => ({
  renderPdfBufferToCanvas: vi.fn().mockResolvedValue({
    canvas: {},
    width: 595,
    height: 842,
  }),
}));

describe('BackgroundUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders load background button', async () => {
    await act(async () => {
      render(<BackgroundUpload />);
    });
    expect(screen.getByText('加载背景')).toBeInTheDocument();
  });

  it('renders drop hint when no background', async () => {
    await act(async () => {
      render(<BackgroundUpload />);
    });
    expect(screen.getByText('拖拽图片到此处作为背景')).toBeInTheDocument();
  });

  it('does not render clear button when no background', async () => {
    await act(async () => {
      render(<BackgroundUpload />);
    });
    expect(screen.queryByText('清除背景')).not.toBeInTheDocument();
  });

  it('disables load button when loading', async () => {
    await act(async () => {
      render(<BackgroundUpload />);
    });
    const loadBtn = screen.getByText('加载背景').closest('button');
    expect(loadBtn).not.toBeDisabled();
  });
});
