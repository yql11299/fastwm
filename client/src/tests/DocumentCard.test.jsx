import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DocumentCard from '../components/documents/DocumentCard';

describe('DocumentCard Component', () => {
  const mockDocument = {
    id: 'doc_001',
    name: '身份证.jpg',
    path: '/documents/身份证.jpg',
    type: 'jpg',
    size: 1024000,
  };

  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it('renders document name without extension', () => {
    render(<DocumentCard document={mockDocument} />);
    expect(screen.getByText('身份证')).toBeInTheDocument();
  });

  it('displays file size', () => {
    render(<DocumentCard document={mockDocument} />);
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });

  it('shows checkbox by default', () => {
    render(<DocumentCard document={mockDocument} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('hides checkbox when showCheckbox is false', () => {
    render(<DocumentCard document={mockDocument} showCheckbox={false} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    render(<DocumentCard document={mockDocument} onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByText('身份证').closest('div'));
    expect(mockOnSelect).toHaveBeenCalledWith('doc_001');
  });

  it('applies selected class when isSelected is true', () => {
    render(<DocumentCard document={mockDocument} isSelected={true} />);
    const card = screen.getByRole('checkbox').closest('div');
    expect(card).toHaveClass('selected');
  });

  it('toggles checkbox state via click on checkbox', () => {
    render(<DocumentCard document={mockDocument} isSelected={false} onSelect={mockOnSelect} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockOnSelect).toHaveBeenCalledWith('doc_001');
  });

  it('handles keyboard navigation', () => {
    render(<DocumentCard document={mockDocument} onSelect={mockOnSelect} />);
    const card = screen.getByRole('checkbox').closest('div');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockOnSelect).toHaveBeenCalledWith('doc_001');
  });

  it('renders PDF type correctly', () => {
    const pdfDoc = { ...mockDocument, type: 'pdf', name: '合同.pdf' };
    render(<DocumentCard document={pdfDoc} />);
    expect(screen.getByText('合同')).toBeInTheDocument();
  });

  it('handles document without size', () => {
    const noSizeDoc = { ...mockDocument, size: 0 };
    render(<DocumentCard document={noSizeDoc} />);
    expect(screen.queryByText(/KB|MB|B/)).not.toBeInTheDocument();
  });
});
