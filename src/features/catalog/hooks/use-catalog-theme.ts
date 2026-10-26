import { useEffect } from "react";
import type { CatalogTheme } from "../lib/catalog-theme";

/**
 * Aplica o tema da loja na página inteira enquanto o catálogo está aberto —
 * inclusive janelas que abrem por cima (foto ampliada, compartilhar), que
 * ficam fora da div da página. Ao sair, devolve o tema que estava antes.
 */
export function useCatalogTheme(theme: CatalogTheme | null | undefined) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.toggle("dark", theme === "dark");
    return () => {
      root.classList.toggle("dark", hadDark);
    };
  }, [theme]);
}
