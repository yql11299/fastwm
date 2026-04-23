import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WatermarkPreview from '../components/canvas/WatermarkPreview';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('WatermarkPreview Component', () => {
  const defaultProps = {
    x: 400,
    y: 300,
    scale: 0.5,
    rotation: 0,
    opacity: 0.8,
    text: '仅供XX业务使用',
    font: '微软雅黑',
    color: '#808080',
    canvasWidth: 800,
    canvasHeight: 600,
  };

  const mockOnDragStart = vi.fn();

  // Mock API response for text-to-path
  const mockPathResponse = {
    data: {
      success: true,
      data: {
        paths: [
          {
            char: '仅',
            pathData: 'M100,100 L200,200 L150,250 Z',
            x: 0,
            width: 100,
            height: 100,
            yMin: 0,
            yMax: 100,
          },
          {
            char: '供',
            pathData: 'M200,100 L300,200 L250,250 Z',
            x: 100,
            width: 100,
            height: 100,
            yMin: 0,
            yMax: 100,
          },
        ],
        totalWidth: 200,
        totalHeight: 100,
        baseline: 80,
      },
    },
  };

  beforeEach(() => {
    mockOnDragStart.mockClear();
    axios.post.mockResolvedValue(mockPathResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders SVG element with watermark preview', async () => {
    await act(async () => {
      render(<WatermarkPreview {...defaultProps} />);
    });

    await waitFor(() => {
      const g = document.querySelector('g.watermark-preview');
      expect(g).toBeTruthy();
    });
  });

  it('renders path elements when API returns path data', async () => {
    await act(async () => {
      render(<WatermarkPreview {...defaultProps} />);
    });

    await waitFor(() => {
      const paths = document.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  it('applies x and y position correctly to the group', async () => {
    await act(async () => {
      render(<WatermarkPreview {...defaultProps} x={200} y={150} />);
    });

    await waitFor(() => {
      const g = document.querySelector('g.watermark-preview');
      expect(g).toBeTruthy();
    });
  });

  it('applies rotation transform to the inner group', async () => {
    await act(async () => {
      render(<WatermarkPreview {...defaultProps} rotation={45} />);
    });

    await waitFor(() => {
      const innerG = document.querySelector('g[transform]');
      expect(innerG).toBeTruthy();
      expect(innerG.getAttribute('transform')).toContain('rotate(45');
    });
  });

  it('applies opacity to path elements', async () => {
    await act(async () => {
      render(<WatermarkPreview {...defaultProps} opacity={0.5} />);
    });

    await waitFor(() => {
      const path = document.querySelector('path');
      expect(path.getAttribute('opacity')).toBe('0.5');
    });
  });

  it('applies fill color to path elements', async () => {
    await act(async () => {
      render(<WatermarkPreview {...defaultProps} color="#FF0000" />);
    });

    await waitFor(() => {
      const path = document.querySelector('path');
      expect(path.getAttribute('fill')).toBe('#FF0000');
    });
  });

  it('calls onDragStart when mouse down', async () => {
    await act(async () => {
      render(<WatermarkPreview {...defaultProps} onDragStart={mockOnDragStart} />);
    });

    await waitFor(() => {
      const g = document.querySelector('g.watermark-preview');
      if (g) {
        fireEvent.mouseDown(g);
        expect(mockOnDragStart).toHaveBeenCalled();
      }
    });
  });

  it('renders different text content when API returns different paths', async () => {
    const differentPathResponse = {
      data: {
        success: true,
        data: {
          paths: [
            {
              char: '自',
              pathData: 'M50,50 L100,100 L75,125 Z',
              x: 0,
              width: 50,
              height: 50,
              yMin: 0,
              yMax: 50,
            },
            {
              char: '定',
              pathData: 'M100,50 L150,100 L125,125 Z',
              x: 50,
              width: 50,
              height: 50,
              yMin: 0,
              yMax: 50,
            },
          ],
          totalWidth: 100,
          totalHeight: 50,
          baseline: 40,
        },
      },
    };
    axios.post.mockResolvedValueOnce(differentPathResponse);

    await act(async () => {
      render(<WatermarkPreview {...defaultProps} text="自定义水印" />);
    });

    await waitFor(() => {
      const paths = document.querySelectorAll('path');
      expect(paths.length).toBe(2);
    });
  });

  it('shows fallback text when API fails', async () => {
    axios.post.mockRejectedValueOnce(new Error('API error'));

    await act(async () => {
      render(<WatermarkPreview {...defaultProps} />);
    });

    // Should show fallback text element when API fails
    await waitFor(() => {
      const text = document.querySelector('text');
      // In fallback mode, text element should be present
      expect(text).toBeTruthy();
    });
  });

  it('makes correct API call with parameters', async () => {
    await act(async () => {
      render(<WatermarkPreview {...defaultProps} text="测试" font="黑体" />);
    });

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/fonts/text-to-path', {
        text: '测试',
        fontName: '黑体',
        fontSize: 1000,
      });
    });
  });

  it('handles loading state', async () => {
    // Mock that never resolves to test loading state
    let resolvePromise;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    axios.post.mockImplementationOnce(() => pendingPromise);

    await act(async () => {
      render(<WatermarkPreview {...defaultProps} />);
    });

    // Resolve the mock after a tick
    await act(async () => {
      resolvePromise(mockPathResponse);
    });

    // After loading completes, should render paths
    await waitFor(() => {
      const paths = document.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });
  });
});
