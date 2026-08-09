import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShippingLabelPrintDialog } from '../../printing/components/ShippingLabelPrintDialog';
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

describe('ShippingLabelPrintDialog UI', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    labelData: {
      type: 'pdf' as const,
      content: 'bW9jay1jb250ZW50', // base64 for 'mock-content'
      id: 'sale-123',
      origin: 'Mercado Livre'
    },
  };

  it('should show PDF preview when loaded', async () => {
    render(<ShippingLabelPrintDialog {...defaultProps} />);
    
    await waitFor(() => {
      const iframe = screen.getByTitle('Visualização');
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute('src')).toBe('blob:mock-url');
    }, { timeout: 2000 });
  });

  it('should disable buttons during printing', async () => {
    const { printManager } = await import('@/features/printing/services/print.service');
    // Force a long print delay
    (printManager.print as any).mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)));

    render(<ShippingLabelPrintDialog {...defaultProps} />);
    
    await waitFor(() => screen.getByRole('button', { name: /Imprimir/i }));
    
    const printButton = screen.getByRole('button', { name: /Imprimir/i });
    fireEvent.click(printButton);
    
    expect(printButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Baixar/i }).hasAttribute('disabled')).toBe(true);
  });
});
