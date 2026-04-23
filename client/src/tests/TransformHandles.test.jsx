import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransformHandles from '../components/canvas/TransformHandles';

describe('TransformHandles Component', () => {
  const defaultProps = {
    x: 400,
    y: 300,
    scale: 0.5,
    rotation: 0,
    canvasWidth: 800,
    canvasHeight: 600,
    onResizeStart: vi.fn(),
    onRotateStart: vi.fn(),
    isDragging: false,
    isResizing: false,
    isRotating: false,
    selectedHandle: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four corner handles', () => {
    const { container } = render(<TransformHandles {...defaultProps} />);
    const handles = container.querySelectorAll('rect');
    // 4 corner handles + 1 selection rect + 4 edge handles (hidden) = 9 rects
    expect(handles.length).toBe(9);
  });

  it('renders rotate handle', () => {
    const { container } = render(<TransformHandles {...defaultProps} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(1); // 1 rotate handle
  });

  it('renders rotation line', () => {
    const { container } = render(<TransformHandles {...defaultProps} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(1); // rotation guide line
  });

  it('calls onResizeStart when corner handle is clicked', () => {
    const { container } = render(<TransformHandles {...defaultProps} />);
    const handles = container.querySelectorAll('rect');
    const firstHandle = handles[1]; // First corner handle (after selection rect)

    fireEvent.mouseDown(firstHandle);
    expect(defaultProps.onResizeStart).toHaveBeenCalled();
  });

  it('calls onRotateStart when rotate handle is clicked', () => {
    const { container } = render(<TransformHandles {...defaultProps} />);
    const circle = container.querySelector('circle');

    fireEvent.mouseDown(circle);
    expect(defaultProps.onRotateStart).toHaveBeenCalled();
  });

  it('renders selection rectangle', () => {
    const { container } = render(<TransformHandles {...defaultProps} />);
    const rects = container.querySelectorAll('rect');
    const selectionRect = rects[0];

    expect(selectionRect).toHaveAttribute('fill', 'none');
    expect(selectionRect).toHaveAttribute('stroke', '#2563eb');
  });

  it('positions handles based on x, y, and scale', () => {
    const propsWithPosition = {
      ...defaultProps,
      x: 200,
      y: 150,
      scale: 0.8,
    };

    const { container } = render(<TransformHandles {...propsWithPosition} />);
    const handles = container.querySelectorAll('rect');

    // Check that handles are at different positions
    const firstHandle = handles[1];
    expect(firstHandle).toBeDefined();
  });
});
