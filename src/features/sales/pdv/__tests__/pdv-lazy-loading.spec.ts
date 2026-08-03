import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React, { Suspense, lazy } from "react";

// Mock do componente que será carregado via lazy
const MockComponent = ({ text }: { text: string }) => <div>{text}</div>;

describe("PDV Lazy Components (Sprint RC.1.3)", () => {
  it("should show fallback while loading lazy component", async () => {
    // Simula um carregamento lento do componente
    const LazyComponent = lazy(() => 
      new Promise<{ default: React.ComponentType<{ text: string }> }>(resolve => {
        setTimeout(() => resolve({ default: MockComponent }), 100);
      })
    );

    render(
      <Suspense fallback={<div data-testid="fallback">Loading...</div>}>
        <LazyComponent text="Loaded Content" />
      </Suspense>
    );

    // O fallback deve estar visível inicialmente
    expect(screen.getByTestId("fallback")).toBeDefined();

    // Após o timeout, o conteúdo carregado deve estar visível
    await waitFor(() => {
      expect(screen.getByText("Loaded Content")).toBeDefined();
    }, { timeout: 1000 });
    
    expect(screen.queryByTestId("fallback")).toBeNull();
  });

  it("should handle error in lazy component gracefully", async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
      }
      static getDerivedStateFromError() {
        return { hasError: true };
      }
      render() {
        if (this.state.hasError) return <div>Error Loading</div>;
        return this.props.children;
      }
    }

    const LazyErrorComponent = lazy(() => Promise.reject(new Error("Failed to fetch")));

    render(
      <ErrorBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          <LazyErrorComponent />
        </Suspense>
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText("Error Loading")).toBeDefined();
    });
    
    errorSpy.mockRestore();
  });
});
