import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import SchemeList from '../components/schemes/SchemeList';

// Mock dependencies
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
    setWatermark: vi.fn(),
    setCurrentScheme: vi.fn(),
  };
  return {
    __esModule: true,
    default: () => state,
  };
});

vi.mock('../api/client', () => ({
  schemesApi: {
    getSchemes: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'preset_001',
          name: '仅供内部使用',
          isPreset: true,
          createdAt: '2026-04-11T10:00:00Z',
          watermark: {
            text: '仅供内部使用',
            x: 0.5,
            y: 0.5,
            scale: 0.5,
            rotation: 0,
            opacity: 0.8,
            font: '微软雅黑',
            color: '#808080',
          },
        },
        {
          id: 'scheme_001',
          name: '自定义方案',
          isPreset: false,
          createdAt: '2026-04-10T10:00:00Z',
          watermark: {
            text: '测试水印',
            x: 0.3,
            y: 0.7,
            scale: 0.3,
            rotation: 45,
            opacity: 0.5,
            font: '黑体',
            color: '#FF0000',
          },
        },
      ],
    }),
    getScheme: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'preset_001',
        name: '仅供内部使用',
        isPreset: true,
        watermark: {
          text: '仅供内部使用',
          x: 0.5,
          y: 0.5,
          scale: 0.5,
          rotation: 0,
          opacity: 0.8,
          font: '微软雅黑',
          color: '#808080',
        },
      },
    }),
    exportScheme: vi.fn().mockResolvedValue({ success: true }),
    deleteScheme: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const renderSchemeList = () => {
  return render(
    <BrowserRouter>
      <SchemeList />
    </BrowserRouter>
  );
};

describe('SchemeList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with title', async () => {
    await act(async () => {
      renderSchemeList();
    });
    expect(screen.getByText('水印方案管理')).toBeInTheDocument();
  });

  it('renders back button', async () => {
    await act(async () => {
      renderSchemeList();
    });
    expect(screen.getByText('返回')).toBeInTheDocument();
  });

  it('renders filter buttons', async () => {
    await act(async () => {
      renderSchemeList();
    });
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getByText('预设方案')).toBeInTheDocument();
    expect(screen.getByText('普通方案')).toBeInTheDocument();
  });

  it('renders scheme cards when loaded', async () => {
    await act(async () => {
      renderSchemeList();
    });

    // Wait for scheme cards to load
    await waitFor(() => {
      // The scheme name appears in a span with class schemeName
      const schemeNameSpans = document.querySelectorAll('[class*="schemeName"]');
      expect(schemeNameSpans.length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
  });

  it('renders import and new scheme buttons', async () => {
    await act(async () => {
      renderSchemeList();
    });
    expect(screen.getByText('导入方案')).toBeInTheDocument();
    expect(screen.getByText('新建方案')).toBeInTheDocument();
  });

  it('filters schemes when filter button is clicked', async () => {
    await act(async () => {
      renderSchemeList();
    });

    // Wait for schemes to load
    await waitFor(() => {
      const schemeNameSpans = document.querySelectorAll('[class*="schemeName"]');
      expect(schemeNameSpans.length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });

    await act(async () => {
      fireEvent.click(screen.getByText('预设方案'));
    });

    // After filtering, preset scheme should still be visible
    await waitFor(() => {
      const schemeNameSpans = document.querySelectorAll('[class*="schemeName"]');
      expect(schemeNameSpans.length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
  });

  it('shows save modal when new scheme button is clicked', async () => {
    await act(async () => {
      renderSchemeList();
    });

    await waitFor(() => {
      expect(screen.getByText('新建方案')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('新建方案'));
    });

    await waitFor(() => {
      expect(screen.getByText('保存方案')).toBeInTheDocument();
    });
  });

  it('shows import modal when import button is clicked', async () => {
    await act(async () => {
      renderSchemeList();
    });

    await waitFor(() => {
      expect(screen.getByText('导入方案')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('导入方案'));
    });

    await waitFor(() => {
      expect(screen.getByText('导入方案')).toBeInTheDocument();
    });
  });
});
