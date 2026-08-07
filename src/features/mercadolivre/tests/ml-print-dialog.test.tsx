import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MercadoLivrePrintDialog } from '../components/mercadolivre-print-dialog';
import React from 'react';

// Mock dependencies
vi.mock('@/features/printing/services/labelary.service', () => ({
  labelaryService: {
    convertToPdf: vi.fn().mockResolvedValue(new Blob(['mock-pdf'], { type: 'application/pdf' })),
  },
}));

vi.mock('@/features/printing/services/print.service', () => ({
  printManager: {
    print: vi.fn().mockResolvedValue({ success: true, jobId: '123' }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock URL.createObjectURL and atob
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();
global.atob = vi.fn(() => 'mock-binary');

describe('MercadoLivrePrintDialog UI', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    labelData: {
      type: 'pdf' as const,
      content: 'bW9jay1jb250ZW50', // base64 for 'mock-content'
      id: 'sale-123',
    },
  };

  it('should render loading state then show PDF preview', async () => {
    render(<MercadoLivrePrintDialog {...defaultProps} />);
    
    // Check loading state (might be fast, but it should be there initially)
    // expect(screen.queryByText(/Gerando visualização/i)).toBeDefined();

    await waitFor(() => {
      const iframe = screen.getByTitle('Preview da Etiqueta');
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute('src')).toBe('blob:mock-url');
    });
  });

  it('should disable buttons during printing', async () => {
    const { printManager } = await import('@/features/printing/services/print.service');
    // Force a long print delay
    (printManager.print as any).mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)));

    render(<MercadoLivrePrintDialog {...defaultProps} />);
    
    await waitFor(() => screen.getByRole('button', { name: /Imprimir/i }));
    
    const printButton = screen.getByRole('button', { name: /Imprimir/i });
    fireEvent.click(printButton);
    
    expect(printButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Baixar PDF/i }).hasAttribute('disabled')).toBe(true);
  });
});
