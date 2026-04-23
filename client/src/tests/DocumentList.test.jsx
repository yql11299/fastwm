import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import DocumentList from '../components/documents/DocumentList';

// Mock dependencies
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    currentUser: { id: 'admin', username: 'admin' },
    logout: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('../stores/appStore', () => ({
  __esModule: true,
  default: () => ({
    documents: [],
    selectedDocuments: [],
    setDocuments: vi.fn(),
    setSelectedDocuments: vi.fn(),
    toggleDocumentSelection: vi.fn(),
    selectAllDocuments: vi.fn(),
    clearSelection: vi.fn(),
    favorites: [
      { id: 'doc_001', name: '身份证', path: '/documents/身份证.jpg', type: 'jpg', isDirectory: false },
      { id: 'doc_002', name: '驾照', path: '/documents/驾照.jpg', type: 'jpg', isDirectory: false },
    ],
    setFavorites: vi.fn(),
    layoutItems: [
      { fileId: 'doc_001', fileName: '身份证', filePath: '/documents/身份证.jpg', fileType: 'jpg', row: 0, order: 0 },
      { fileId: 'doc_002', fileName: '驾照', filePath: '/documents/驾照.jpg', fileType: 'jpg', row: 0, order: 1 },
    ],
    setLayoutItems: vi.fn(),
    watermark: { text: '仅供XX业务使用' },
    setWatermark: vi.fn(),
    isProcessing: false,
    setProcessing: vi.fn(),
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
          { fileId: 'doc_002', fileName: '驾照', filePath: '/documents/驾照.jpg', fileType: 'jpg', row: 0, order: 1 },
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
  processApi: {
    processWatermark: vi.fn().mockResolvedValue({
      success: true,
      data: { taskId: 'task_001', status: 'completed' },
    }),
    getStatus: vi.fn().mockResolvedValue({
      success: true,
      data: { status: 'completed' },
    }),
    downloadResult: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const renderDocumentList = () => {
  return render(
    <BrowserRouter>
      <DocumentList />
    </BrowserRouter>
  );
};

describe('DocumentList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with logo and user info', () => {
    renderDocumentList();
    expect(screen.getByText('证件水印处理系统')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('renders watermark input', () => {
    renderDocumentList();
    expect(screen.getByLabelText('水印文字:')).toBeInTheDocument();
  });

  it('renders generate button', () => {
    renderDocumentList();
    expect(screen.getByRole('button', { name: /一键生成/ })).toBeInTheDocument();
  });

  it('renders scheme dropdown', () => {
    renderDocumentList();
    expect(screen.getByLabelText('预设方案:')).toBeInTheDocument();
  });

  it('renders new scheme button', () => {
    renderDocumentList();
    expect(screen.getByRole('button', { name: /新建方案/ })).toBeInTheDocument();
  });

  it('shows selected count when no documents selected', async () => {
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('已选择 0 项')).toBeInTheDocument();
    });
  });

  it('shows logout confirmation modal', async () => {
    renderDocumentList();

    fireEvent.click(screen.getByRole('button', { name: /登出/ }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '确认登出' })).toBeInTheDocument();
    });
  });

  it('closes logout modal when cancel is clicked', async () => {
    renderDocumentList();

    fireEvent.click(screen.getByRole('button', { name: /登出/ }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '确认登出' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /取消/ }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '确认登出' })).not.toBeInTheDocument();
    });
  });

  it('renders document items from favorites', async () => {
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('身份证')).toBeInTheDocument();
      expect(screen.getByText('驾照')).toBeInTheDocument();
    });
  });
});
