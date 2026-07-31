/**
 * Autenticação dos endpoints de job (`/api/public/jobs/*`).
 *
 * `/api/public/*` ignora a autenticação do site publicado, portanto cada job
 * precisa validar a credencial por conta própria.
 *
 * IMPORTANTE (N-01): NÃO usar a chave publishable do Supabase — ela é pública
 * e trafega no bundle do browser. A autenticação é feita exclusivamente com o
 * segredo dedicado `CRON_JOB_SECRET`, enviado como `Authorization: Bearer …`
 * (ou header `x-cron-secret`), comparado em tempo constante.
 *
 * Fail-closed: sem segredo configurado, nenhum job executa (503).
 */

/** Comparação em tempo constante — independe do tamanho/conteúdo. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Mistura o comprimento no resultado sem sair cedo.
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** Extrai a credencial apresentada, sem fallback para chaves públicas. */
export function extractJobCredential(request: Request): string {
  const auth = request.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, "").trim();
  }
  return request.headers.get("x-cron-secret")?.trim() ?? "";
}

export interface JobAuthDeps {
  /** Segredo esperado. Default: `process.env.CRON_JOB_SECRET`. */
  readonly secret?: string | undefined;
}

/**
 * Retorna `null` quando autorizado, ou a `Response` de erro a devolver.
 */
export function authorizeJobRequest(request: Request, deps: JobAuthDeps = {}): Response | null {
  const expected = deps.secret ?? process.env.CRON_JOB_SECRET;

  if (!expected || expected.length < 16) {
    console.error(
      "[jobs] CRÍTICO: CRON_JOB_SECRET ausente ou fraco — execução negada (fail-closed)",
    );
    return new Response(JSON.stringify({ ok: false, error: "job_auth_not_configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const provided = extractJobCredential(request);
  if (!provided || !timingSafeEqual(provided, expected)) {
    console.warn("[jobs] credencial inválida — 401");
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return null;
}
