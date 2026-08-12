import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShippingLabelPrintDialog } from '../../printing/components/ShippingLabelPrintDialog';
import React from 'react';

// ShippingLabelPrintDialog renderiza PrinterSelector, que usa useQuery — precisa
// de um QueryClientProvider real no teste (não só mocks de service).
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// Mock dependencies
vi.mock('@/features/printing/services/labelary.service', () => ({
  labelaryService: {
    convertToPdf: vi.fn().mockResolvedValue(new Blob(['mock-pdf'], { type: 'application/pdf' })),
    getLastAudit: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('@/features/printing/services/print.service', () => ({
  printManager: {
    print: vi.fn().mockResolvedValue({ success: true, jobId: '123' }),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('@/features/printing/services/printer.service', () => ({
  printerService: {
    listPrinters: vi.fn().mockResolvedValue([]),
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
    renderWithProviders(<ShippingLabelPrintDialog {...defaultProps} />);
    
    await waitFor(() => {
      const iframe = screen.getByTitle('Visualização');
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute('src')).toContain('blob:mock-url');
    }, { timeout: 2000 });
  });

  it('should disable buttons during printing', async () => {
    const { printManager } = await import('@/features/printing/services/print.service');
    // Force a long print delay
    (printManager.print as any).mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)));

    renderWithProviders(<ShippingLabelPrintDialog {...defaultProps} />);
    
    await waitFor(() => screen.getByRole('button', { name: /Imprimir/i }));
    
    const printButton = screen.getByRole('button', { name: /Imprimir/i });
    fireEvent.click(printButton);
    
    expect(printButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Baixar/i }).hasAttribute('disabled')).toBe(true);
  });
});
