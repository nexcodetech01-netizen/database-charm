/** Tema do catálogo público de cada loja (Configurações › Empresa). */
export type CatalogTheme = "light" | "dark";

type ThemeClient = {
  from: (table: "companies") => {
    select: (cols: string) => {
      eq: (
        col: string,
        value: string,
      ) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

/**
 * Lê o tema da loja. Consulta separada e tolerante: se a coluna ainda não
 * existe (SQL não rodado) o catálogo segue no tema claro, sem quebrar.
 */
export async function loadCatalogTheme(client: unknown, companyId: string): Promise<CatalogTheme> {
  try {
    const { data, error } = await (client as ThemeClient)
      .from("companies")
      .select("catalog_theme")
      .eq("id", companyId)
      .maybeSingle();
    if (error || !data) return "light";
    return (data as { catalog_theme?: string | null }).catalog_theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
