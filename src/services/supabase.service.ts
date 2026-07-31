/**
 * Thin service layer around the Supabase client. Feature modules should
 * consume this instead of importing the client directly, so we can add
 * cross-cutting concerns (logging, retries, error mapping) in one place.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesUpdate } from "@/integrations/supabase/types";

export const supabaseService = {
  client: supabase,
  auth: supabase.auth,
  storage: supabase.storage,
  from: supabase.from.bind(supabase),
};

type TableName = keyof Database["public"]["Tables"];


/**
 * updateRow — helper padronizado para operações de UPDATE.
 *
 * - Usa `.maybeSingle()` para evitar o erro PGRST116 que ocorre quando
 *   RLS/triggers bloqueiam silenciosamente a atualização.
 * - Lança erro explícito ("registro não encontrado ou sem permissão")
 *   quando nada é atualizado, permitindo feedback claro na UI.
 * - Aceita apenas `TablesUpdate<T>` — colunas imutáveis como `company_id`
 *   devem ser omitidas pelo chamador.
 */
export async function updateRow<T extends TableName>(
  table: T,
  id: string,
  patch: TablesUpdate<T>,
): Promise<Tables<T>> {
  // O tipo dinâmico do PostgREST builder é uma união muito estrita para
  // aceitar generics. Cast controlado apenas neste helper mantém o resto
  // do código totalmente tipado via TablesUpdate<T> / Tables<T>.
  const client = supabase as unknown as {
    from: (table: string) => {
      update: (patch: unknown) => {
        eq: (col: string, val: string) => {
          select: () => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
  };
  const { data, error } = await client
    .from(table)
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Registro não encontrado ou sem permissão para editar.");
  }
  return data as Tables<T>;
}

