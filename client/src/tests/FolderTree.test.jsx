import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FolderTree from '../components/documents/FolderTree';

describe('FolderTree Component', () => {
  const mockItems = [
    {
      id: 'doc_001',
      name: '身份证.jpg',
      path: '/documents/身份证.jpg',
      type: 'jpg',
      size: 1024000,
      isDirectory: false,
    },
    {
      id: 'dir_001',
      name: 'personal',
      path: '/documents/personal',
      type: 'directory',
      size: 0,
      isDirectory: true,
      children: [
        {
          id: 'doc_002',
          name: '驾照.jpg',
          path: '/documents/personal/驾照.jpg',
          type: 'jpg',
          size: 800000,
          isDirectory: false,
        },
      ],
    },
    {
      id: 'doc_003',
      name: '营业执照.pdf',
      path: '/documents/营业执照.pdf',
      type: 'pdf',
      size: 2048000,
      isDirectory: false,
    },
  ];

  const mockOnFolderClick = vi.fn().mockResolvedValue(undefined);
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnFolderClick.mockClear();
    mockOnSelect.mockClear();
  });

  it('renders all top-level items', () => {
    render(<FolderTree items={mockItems} />);
    expect(screen.getByText('身份证.jpg')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
    expect(screen.getByText('营业执照.pdf')).toBeInTheDocument();
  });

  it('filters out non-image/PDF files', () => {
    const itemsWithOther = [
      ...mockItems,
      { id: 'doc_004', name: 'readme.txt', path: '/documents/readme.txt', type: 'txt', isDirectory: false },
    ];
    render(<FolderTree items={itemsWithOther} />);
    expect(screen.queryByText('readme.txt')).not.toBeInTheDocument();
  });

  it('expands directory when clicked', async () => {
    render(<FolderTree items={mockItems} onFolderClick={mockOnFolderClick} />);

    const folderRow = screen.getByText('personal').closest('div');
    fireEvent.click(folderRow);

    await waitFor(() => {
      expect(mockOnFolderClick).toHaveBeenCalled();
    });
  });

  it('shows children when directory is expanded', async () => {
    const itemsWithChildren = [
      {
        id: 'dir_001',
        name: 'personal',
        path: '/documents/personal',
        type: 'directory',
        isDirectory: true,
        children: [
          { id: 'doc_002', name: '驾照.jpg', path: '/documents/personal/驾照.jpg', type: 'jpg', isDirectory: false },
        ],
      },
    ];

    render(<FolderTree items={itemsWithChildren} />);

    // Initially children should not be visible
    expect(screen.queryByText('驾照.jpg')).not.toBeInTheDocument();

    // Click to expand
    const folderRow = screen.getByText('personal').closest('div');
    fireEvent.click(folderRow);

    // Children should now be visible
    await waitFor(() => {
      expect(screen.getByText('驾照.jpg')).toBeInTheDocument();
    });
  });

  it('calls onSelect when item is clicked', () => {
    render(<FolderTree items={mockItems} onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByText('身份证.jpg'));
    expect(mockOnSelect).toHaveBeenCalledWith(mockItems[0]);
  });

  it('shows checkbox for files', () => {
    render(<FolderTree items={mockItems} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2); // Only files have checkboxes
  });

  it('shows loading spinner when fetching children', async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 100));
    const slowOnFolderClick = vi.fn().mockImplementation(() => slowPromise);

    render(<FolderTree items={mockItems} onFolderClick={slowOnFolderClick} />);

    const folderRow = screen.getByText('personal').closest('div');
    fireEvent.click(folderRow);

    // Spinner should be visible
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('renders empty state when no items', () => {
    render(<FolderTree items={[]} />);
    expect(screen.getByText('暂无文件')).toBeInTheDocument();
  });
});
