import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LayoutCanvas from '../components/canvas/LayoutCanvas';

// Mock dependencies
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    currentUser: { id: 'admin', username: 'admin' },
    logout: vi.fn(),
  }),
}));

vi.mock('../stores/appStore', () => ({
  __esModule: true,
  default: () => ({
    favorites: [
      { id: 'doc_001', name: '身份证', path: '/documents/身份证.jpg', type: 'jpg', isDirectory: false },
      { id: 'doc_002', name: '驾照', path: '/documents/驾照.jpg', type: 'jpg', isDirectory: false },
    ],
    setFavorites: vi.fn(),
    layoutItems: [],
    setLayoutItems: vi.fn(),
    addLayoutItem: vi.fn(),
    removeLayoutItem: vi.fn(),
    moveLayoutItem: vi.fn(),
    watermark: { text: '测试水印' },
    setWatermark: vi.fn(),
    schemes: [
      { id: 'preset_001', name: '仅供内部使用', isPreset: true, watermark: { text: '仅供内部使用' } },
    ],
    setSchemes: vi.fn(),
    setCurrentScheme: vi.fn(),
  }),
}));

vi.mock('../api/client', () => ({
  documentsApi: {
    getDocuments: vi.fn().mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'doc_001', name: '身份证', path: '/documents/身份证.jpg', type: 'jpg' },
        ],
      },
    }),
    getFavorites: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { id: 'doc_001', name: '身份证', path: '/documents/身份证.jpg', type: 'jpg', isDirectory: false },
        { id: 'doc_002', name: '驾照', path: '/documents/驾照.jpg', type: 'jpg', isDirectory: false },
      ],
    }),
  },
  layoutApi: {
    getLayout: vi.fn().mockResolvedValue({
      success: true,
      data: {
        userId: 'admin',
        items: [
          { fileId: 'doc_001', fileName: '身份证', filePath: '/documents/身份证.jpg', fileType: 'jpg', row: 0, order: 0 },
        ],
      },
    }),
    saveLayout: vi.fn().mockResolvedValue({ success: true }),
  },
  schemesApi: {
    getSchemes: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { id: 'preset_001', name: '仅供内部使用', isPreset: true, watermark: { text: '仅供内部使用' } },
      ],
    }),
  },
}));

const renderLayoutCanvas = () => {
  return render(
    <BrowserRouter>
      <LayoutCanvas />
    </BrowserRouter>
  );
};

describe('LayoutCanvas Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with title', () => {
    renderLayoutCanvas();
    expect(screen.getByText('调整布局')).toBeInTheDocument();
  });

  it('renders back button', () => {
    renderLayoutCanvas();
    const backBtn = screen.getByText('返回');
    expect(backBtn).toBeInTheDocument();
  });

  it('renders save and cancel buttons', () => {
    renderLayoutCanvas();
    expect(screen.getByRole('button', { name: /保存布局/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument();
  });

  it('renders instructions', () => {
    renderLayoutCanvas();
    expect(screen.getByText(/拖拽证件可以调整位置/)).toBeInTheDocument();
  });

  it('renders document items from favorites', async () => {
    renderLayoutCanvas();
    await waitFor(() => {
      expect(screen.getByText('身份证')).toBeInTheDocument();
      expect(screen.getByText('驾照')).toBeInTheDocument();
    });
  });

  it('renders add documents button', () => {
    renderLayoutCanvas();
    expect(screen.getByRole('button', { name: /添加证件/ })).toBeInTheDocument();
  });

  it('shows save message after saving', async () => {
    renderLayoutCanvas();

    const saveBtn = screen.getByRole('button', { name: /保存布局/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('布局保存成功')).toBeInTheDocument();
    });
  });

  it('renders trash zone', () => {
    renderLayoutCanvas();
    expect(screen.getByText('拖拽到此处删除')).toBeInTheDocument();
  });
});
