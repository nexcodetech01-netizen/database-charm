import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";
import { Toaster } from "@/components/ui/sonner";

/**
 * Composes all global providers used across the app.
 * Kept as a single component so the root route stays clean
 * and so adding a new provider is a one-file change.
 */
interface AppProvidersProps {
  children: ReactNode;
  queryClient: QueryClient;
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="nexos-theme">
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
      <Toaster limit={1} />
    </QueryClientProvider>
  );
}
