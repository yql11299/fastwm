import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SchemeImportModal from '../components/schemes/SchemeImportModal';

// Mock dependencies
vi.mock('../api/client', () => ({
  schemesApi: {
    importScheme: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'scheme_imported',
        name: '导入的方案',
        isPreset: false,
        createdAt: '2026-04-11T10:00:00Z',
      },
    }),
  },
}));

describe('SchemeImportModal Component', () => {
  const mockOnImport = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal title', () => {
    render(<SchemeImportModal onImport={mockOnImport} onClose={mockOnClose} />);
    expect(screen.getByText('导入/导出方案')).toBeInTheDocument();
  });

  it('renders import and export tabs', () => {
    render(<SchemeImportModal onImport={mockOnImport} onClose={mockOnClose} />);
    expect(screen.getByText('导入')).toBeInTheDocument();
    expect(screen.getByText('导出说明')).toBeInTheDocument();
  });

  it('shows drop zone by default', () => {
    render(<SchemeImportModal onImport={mockOnImport} onClose={mockOnClose} />);
    expect(screen.getByText('点击或拖拽上传 JSON 文件')).toBeInTheDocument();
  });

  it('switches to export info when export tab is clicked', () => {
    render(<SchemeImportModal onImport={mockOnImport} onClose={mockOnClose} />);

    fireEvent.click(screen.getByText('导出说明'));

    expect(screen.getByText('导出方案')).toBeInTheDocument();
    expect(screen.getByText('导入方案')).toBeInTheDocument();
  });

  it('renders footer buttons', () => {
    render(<SchemeImportModal onImport={mockOnImport} onClose={mockOnClose} />);
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入' })).toBeInTheDocument();
  });

  it('disables import button when no file is selected', () => {
    render(<SchemeImportModal onImport={mockOnImport} onClose={mockOnClose} />);
    const importBtn = screen.getByRole('button', { name: '导入' });
    expect(importBtn).toBeDisabled();
  });

  it('calls onClose when close button is clicked', () => {
    render(<SchemeImportModal onImport={mockOnImport} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
