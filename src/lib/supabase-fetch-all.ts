/**
 * Busca TODAS as linhas de uma consulta do Supabase, página por página.
 *
 * Por quê: o PostgREST devolve no máximo 1.000 linhas por requisição
 * (`max_rows` do projeto) e corta o resto SEM avisar. Relatórios que somavam
 * no navegador o resultado de uma consulta sem paginação mostravam valores
 * errados para empresas com mais de 1.000 vendas/lançamentos no período
 * (auditoria 2026-10-22).
 *
 * Uso: monte a consulta normalmente (sem `.range`/`.limit`) e passe para
 * `fetchAllRows`. A função acrescenta um desempate estável (`id` por padrão)
 * à ordenação, para as páginas não repetirem nem pularem linhas.
 */

type PostgrestLikeResult = { data: unknown; error: unknown };

export interface PageableQuery extends PromiseLike<PostgrestLikeResult> {
  range(from: number, to: number): PageableQuery;
  order(column: string, options?: { ascending?: boolean }): PageableQuery;
}

type RowsOf<Q> =
  Q extends PromiseLike<{ data: infer D }>
    ? D extends ReadonlyArray<infer R>
      ? R[]
      : D extends null
        ? never[]
        : NonNullable<D> extends ReadonlyArray<infer R2>
          ? R2[]
          : unknown[]
    : unknown[];

export interface FetchAllOptions {
  /** Tamanho da página (≤ max_rows do projeto). Padrão: 1000. */
  pageSize?: number;
  /** Teto de segurança. Padrão: 100.000 linhas. */
  maxRows?: number;
  /** Coluna de desempate para paginação estável. `null` para não acrescentar. */
  tiebreaker?: string | null;
}

export const DEFAULT_PAGE_SIZE = 1000;
export const DEFAULT_MAX_ROWS = 100_000;

export async function fetchAllRows<Q extends PageableQuery>(
  query: Q,
  options: FetchAllOptions = {},
): Promise<RowsOf<Q>> {
  const pageSize = Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE);
  const maxRows = Math.max(pageSize, options.maxRows ?? DEFAULT_MAX_ROWS);
  const tiebreaker = options.tiebreaker === undefined ? "id" : options.tiebreaker;

  const base = tiebreaker ? query.order(tiebreaker, { ascending: true }) : query;
  const all: unknown[] = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await base.range(from, from + pageSize - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    all.push(...page);
    if (page.length < pageSize) return all as RowsOf<Q>;
  }

  console.warn(
    `[fetchAllRows] teto de ${maxRows} linhas atingido — resultado pode estar incompleto.`,
  );
  return all as RowsOf<Q>;
}

/**
 * Executa `fn` em lotes de ids (evita URLs gigantes em `.in("id", [...])`,
 * que estouram o limite de tamanho da requisição com milhares de ids).
 */
export async function fetchInChunks<T>(
  ids: readonly string[],
  fn: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
  chunkSize = 200,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const { data, error } = await fn(ids.slice(i, i + chunkSize));
    if (error) throw error;
    if (data) out.push(...data);
  }
  return out;
}
