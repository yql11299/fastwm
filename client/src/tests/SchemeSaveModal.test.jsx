import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SchemeSaveModal from '../components/schemes/SchemeSaveModal';

// Mock dependencies
vi.mock('../api/client', () => ({
  schemesApi: {
    createScheme: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'scheme_new',
        name: '新方案',
        isPreset: false,
        createdAt: '2026-04-11T10:00:00Z',
      },
    }),
  },
}));

describe('SchemeSaveModal Component', () => {
  const mockWatermark = {
    text: '仅供XX业务使用',
    x: 0.5,
    y: 0.5,
    scale: 0.5,
    rotation: 0,
    opacity: 0.8,
    font: '微软雅黑',
    color: '#808080',
  };

  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal title', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    expect(screen.getByText('保存方案')).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    const closeBtn = screen.getByRole('button', { name: '' });
    expect(closeBtn).toBeInTheDocument();
  });

  it('renders name input', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText('请输入方案名称');
    expect(input).toBeInTheDocument();
  });

  it('renders preset checkbox', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(screen.getByText('设为预设方案')).toBeInTheDocument();
  });

  it('renders preview', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    expect(screen.getByText('预览')).toBeInTheDocument();
    expect(screen.getByText('仅供XX业务使用')).toBeInTheDocument();
  });

  it('renders footer buttons', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables save button when name is empty', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    const saveBtn = screen.getByRole('button', { name: '保存' });
    expect(saveBtn).toBeDisabled();
  });

  it('enables save button when name is entered', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText('请输入方案名称');
    fireEvent.change(input, { target: { value: '新方案' } });

    const saveBtn = screen.getByRole('button', { name: '保存' });
    expect(saveBtn).not.toBeDisabled();
  });

  it('calls onSave when save is clicked with name', async () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('请输入方案名称');
    fireEvent.change(input, { target: { value: '新方案' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('toggles preset checkbox', () => {
    render(<SchemeSaveModal watermark={mockWatermark} onSave={mockOnSave} onClose={mockOnClose} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
