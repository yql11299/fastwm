import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PropertyPanel from '../components/canvas/PropertyPanel';

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
    fonts: [
      { name: '微软雅黑' },
      { name: '黑体' },
      { name: '楷体' },
    ],
  };
  return {
    __esModule: true,
    default: () => state,
  };
});

describe('PropertyPanel Component', () => {
  const mockOnSave = vi.fn();
  const mockOnSetPreset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders property panel title', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('水印属性')).toBeInTheDocument();
  });

  it('renders watermark text input', () => {
    render(<PropertyPanel />);
    const textarea = screen.getByPlaceholderText('请输入水印文字');
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('仅供XX业务使用');
  });

  it('renders position inputs (X and Y)', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
  });

  it('renders scale input', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('缩放')).toBeInTheDocument();
  });

  it('renders rotation input', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('旋转角度')).toBeInTheDocument();
    expect(screen.getByText('°')).toBeInTheDocument();
  });

  it('renders opacity input', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('透明度')).toBeInTheDocument();
  });

  it('renders font select', () => {
    render(<PropertyPanel />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('renders color picker', () => {
    render(<PropertyPanel />);
    const colorInput = screen.getByRole('textbox', { name: '' });
    expect(colorInput).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<PropertyPanel onSave={mockOnSave} onSetPreset={mockOnSetPreset} />);
    expect(screen.getByText('设为预设')).toBeInTheDocument();
    expect(screen.getByText('保存方案')).toBeInTheDocument();
  });

  it('calls onSetPreset when preset button is clicked', () => {
    render(<PropertyPanel onSetPreset={mockOnSetPreset} />);
    fireEvent.click(screen.getByText('设为预设'));
    expect(mockOnSetPreset).toHaveBeenCalled();
  });

  it('calls onSave when save button is clicked', () => {
    render(<PropertyPanel onSave={mockOnSave} />);
    fireEvent.click(screen.getByText('保存方案'));
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('updates watermark text when changed', () => {
    render(<PropertyPanel />);
    const textarea = screen.getByPlaceholderText('请输入水印文字');

    fireEvent.change(textarea, { target: { value: '新水印文字' } });
    expect(textarea.value).toBe('新水印文字');
  });
});
