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
  return ({ children }: { children: React.ReactNode }) => 
    React.createElement(QueryClientProvider, { client: queryClient }, children);
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

    expect(result.current.isInitialLoading).toBe(true);

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 3000 });
    expect(result.current.size).toBe(1);
    expect(result.current.match("123")).not.toBeNull();
    
    await waitFor(() => expect(result.current.isSyncing).toBe(false), { timeout: 3000 });
    expect(result.current.size).toBe(2);
    expect(result.current.match("456")).not.toBeNull();
  });
});
