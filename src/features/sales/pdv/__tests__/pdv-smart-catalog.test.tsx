import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePdvCatalogIndex } from "../hooks/use-pdv-catalog-index";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import React from "react";

// Mock do Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(),
            })),
          })),
        })),
      })),
    })),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("usePdvCatalogIndex (Smart Catalog)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve carregar lote inicial e depois o completo sem bloquear", async () => {
    const mockInitialData = [
      { id: "1", name: "Produto A", price: 10, barcode: "123" }
    ];
    const mockFullData = [
      { id: "1", name: "Produto A", price: 10, barcode: "123" },
      { id: "2", name: "Produto B", price: 20, barcode: "456" }
    ];

    // Mock das chamadas do Supabase
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation((limit) => {
        if (limit === 200) return Promise.resolve({ data: mockInitialData, error: null });
        return Promise.resolve({ data: mockFullData, error: null });
      }),
    } as any);

    const { result } = renderHook(() => usePdvCatalogIndex("company-1"), {
      wrapper: createWrapper(),
    });

    // Estado inicial
    expect(result.current.isInitialLoading).toBe(true);

    // Aguarda lote inicial
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 3000 });
    expect(result.current.size).toBe(1);
    expect(result.current.match("123")).not.toBeNull();
    
    // Aguarda sincronização completa em background
    await waitFor(() => expect(result.current.isSyncing).toBe(false), { timeout: 3000 });
    expect(result.current.size).toBe(2);
    expect(result.current.match("456")).not.toBeNull();
  });

  it("deve lidar com busca de produto fora do lote inicial", async () => {
    const mockInitialData = [{ id: "1", name: "A", barcode: "123" }];
    
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation((limit) => {
        if (limit === 200) return Promise.resolve({ data: mockInitialData, error: null });
        return new Promise(() => {}); // Simula background carregando infinitamente para testar isSyncing
      }),
    } as any);

    const { result } = renderHook(() => usePdvCatalogIndex("company-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 3000 });
    
    expect(result.current.match("123")).not.toBeNull();
    expect(result.current.match("999")).toBeNull(); 
    expect(result.current.isSyncing).toBe(true); 
  });
});
