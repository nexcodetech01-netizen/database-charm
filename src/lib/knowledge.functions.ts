/**
 * Server functions do Bella Knowledge Hub.
 *
 * Regras:
 *   - Todo acesso ao banco passa por `requireSupabaseAuth` (RLS ativa).
 *   - Nenhum documento completo é enviado ao modelo — só embeddings dos chunks
 *     e, em `searchKnowledge`, os trechos vencedores são retornados ao chamador.
 *   - LOVABLE_API_KEY nunca sai do servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import type { Database } from "@/integrations/supabase/types";
import { chunkText } from "@/features/bella-ai/knowledge/KnowledgeChunker";
import {
  embedTexts,
  KNOWLEDGE_EMBEDDING_DIMS,
} from "@/features/bella-ai/knowledge/KnowledgeEmbeddings";
import type {
  KnowledgeDocument,
  KnowledgeQueryLog,
  KnowledgeSearchHit,
  KnowledgeSearchResult,
  KnowledgeStats,
} from "@/features/bella-ai/knowledge/types";

const uploadSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(80).nullable().optional(),
  author: z.string().max(120).nullable().optional(),
  version: z.string().max(20).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  fileType: z.enum(["pdf", "docx", "txt", "md", "text"]).optional(),
  fileName: z.string().max(200).nullable().optional(),
  fileSize: z.number().int().nonnegative().nullable().optional(),
  content: z.string().min(1).max(2_000_000),
});

async function getCurrentCompanyId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("current_company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.current_company_id) throw new Error("Empresa atual não definida.");
  return data.current_company_id;
}

function mapDocumentRow(row: Record<string, unknown>): KnowledgeDocument {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    title: row.title as string,
    category: (row.category as string) ?? null,
    author: (row.author as string) ?? null,
    version: (row.version as string) ?? "1.0",
    tags: (row.tags as string[]) ?? [],
    status: (row.status as KnowledgeDocument["status"]) ?? "active",
    fileType: (row.file_type as KnowledgeDocument["fileType"]) ?? "text",
    fileName: (row.file_name as string) ?? null,
    fileSize: (row.file_size as number) ?? null,
    contentHash: (row.content_hash as string) ?? null,
    chunkCount: (row.chunk_count as number) ?? 0,
    indexStatus: (row.index_status as KnowledgeDocument["indexStatus"]) ?? "pending",
    indexError: (row.index_error as string) ?? null,
    indexedAt: (row.indexed_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function reindexInternal(
  supabase: SupabaseClient<Database>,
  companyId: string,
  documentId: string,
  content: string,
): Promise<{ chunkCount: number }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor.");

  await supabase
    .from("knowledge_documents")
    .update({ index_status: "indexing", index_error: null })
    .eq("id", documentId);

  // Limpa chunks anteriores.
  await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);

  const chunks = chunkText(content);
  if (chunks.length === 0) {
    await supabase
      .from("knowledge_documents")
      .update({
        index_status: "indexed",
        chunk_count: 0,
        indexed_at: new Date().toISOString(),
      })
      .eq("id", documentId);
    return { chunkCount: 0 };
  }

  try {
    const { vectors } = await embedTexts(
      chunks.map((c) => c.content),
      apiKey,
    );
    if (vectors.some((v) => !v || v.length !== KNOWLEDGE_EMBEDDING_DIMS)) {
      throw new Error("Embedding retornado com dimensão inválida.");
    }
    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      company_id: companyId,
      chunk_index: c.index,
      content: c.content,
      token_estimate: c.tokenEstimate,
      embedding: vectors[i] as unknown as string,
    }));
    // Inserção em blocos para evitar payload gigante.
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase.from("knowledge_chunks").insert(rows.slice(i, i + BATCH));
      if (error) throw new Error(error.message);
    }
    await supabase
      .from("knowledge_documents")
      .update({
        index_status: "indexed",
        chunk_count: chunks.length,
        indexed_at: new Date().toISOString(),
        index_error: null,
      })
      .eq("id", documentId);
    return { chunkCount: chunks.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao indexar.";
    await supabase
      .from("knowledge_documents")
      .update({ index_status: "error", index_error: msg })
      .eq("id", documentId);
    throw err;
  }
}

async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* -------------------- Public server functions -------------------- */

export const uploadKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }): Promise<KnowledgeDocument> => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.create", {
      action: "bella.knowledge.upload",
      module: "bella_ia",
    });
    const { supabase, userId } = context;
    const companyId = await getCurrentCompanyId(supabase, userId);
    const contentHash = await hashContent(data.content);

    const { data: inserted, error } = await supabase
      .from("knowledge_documents")
      .insert({
        company_id: companyId,
        title: data.title,
        category: data.category ?? null,
        author: data.author ?? null,
        version: data.version ?? "1.0",
        tags: data.tags ?? [],
        status: "active",
        file_type: data.fileType ?? "text",
        file_name: data.fileName ?? null,
        file_size: data.fileSize ?? null,
        content_hash: contentHash,
        chunk_count: 0,
        index_status: "pending",
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await reindexInternal(supabase, companyId, inserted.id, data.content);

    const { data: fresh } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", inserted.id)
      .single();
    return mapDocumentRow(fresh ?? inserted);
  });

export const listKnowledgeDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KnowledgeDocument[]> => {
    const { data, error } = await context.supabase
      .from("knowledge_documents")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapDocumentRow(r as Record<string, unknown>));
  });

export const getKnowledgeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KnowledgeStats> => {
    const { data, error } = await context.supabase
      .from("knowledge_documents")
      .select("status,index_status,chunk_count");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    return {
      totalDocuments: rows.length,
      activeDocuments: rows.filter((r) => r.status === "active").length,
      totalChunks: rows.reduce((acc, r) => acc + ((r.chunk_count as number) ?? 0), 0),
      indexedDocuments: rows.filter((r) => r.index_status === "indexed").length,
      pendingDocuments: rows.filter(
        (r) => r.index_status === "pending" || r.index_status === "indexing",
      ).length,
      errorDocuments: rows.filter((r) => r.index_status === "error").length,
    };
  });

export const deleteKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.delete", {
      action: "bella.knowledge.delete",
      module: "bella_ia",
    });
    const { error } = await context.supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setKnowledgeDocumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<KnowledgeDocument> => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.update", {
      action: "bella.knowledge.status",
      module: "bella_ia",
    });
    const { data: row, error } = await context.supabase
      .from("knowledge_documents")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapDocumentRow(row);
  });

export const reindexKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), content: z.string().min(1).max(2_000_000) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<KnowledgeDocument> => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.update", {
      action: "bella.knowledge.reindex",
      module: "bella_ia",
    });
    const { supabase, userId } = context;
    const companyId = await getCurrentCompanyId(supabase, userId);
    await reindexInternal(supabase, companyId, data.id, data.content);
    const { data: fresh, error } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return mapDocumentRow(fresh);
  });

export const searchKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().min(2).max(500),
        topK: z.number().int().min(1).max(20).optional(),
        minSimilarity: z.number().min(0).max(1).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<KnowledgeSearchResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor.");
    const started = Date.now();
    const topK = data.topK ?? 5;
    const minSim = data.minSimilarity ?? 0.2;

    const { vectors } = await embedTexts([data.query], apiKey);
    const queryEmbedding = vectors[0];
    if (!queryEmbedding) throw new Error("Falha ao gerar embedding da consulta.");

    const { data: rows, error } = await context.supabase.rpc("knowledge_match_chunks", {
      query_embedding: queryEmbedding as unknown as string,
      match_count: topK,
      min_similarity: minSim,
    });
    if (error) throw new Error(error.message);

    const hits: KnowledgeSearchHit[] = (rows ?? []).map((r) => ({
      chunkId: r.chunk_id as string,
      documentId: r.document_id as string,
      documentTitle: r.document_title as string,
      documentCategory: (r.document_category as string) ?? null,
      chunkIndex: r.chunk_index as number,
      content: r.content as string,
      similarity: r.similarity as number,
    }));

    const durationMs = Date.now() - started;
    const contextText = hits
      .map(
        (h, i) =>
          `[${i + 1}] ${h.documentTitle}${
            h.documentCategory ? ` · ${h.documentCategory}` : ""
          } (score ${(h.similarity * 100).toFixed(0)}%)\n${h.content.trim()}`,
      )
      .join("\n\n");

    // Log (best-effort — não bloqueia resposta).
    await context.supabase
      .from("knowledge_query_logs")
      .insert({
        company_id: await getCurrentCompanyId(context.supabase, context.userId),
        user_id: context.userId,
        query: data.query,
        top_score: hits[0]?.similarity ?? null,
        document_ids: Array.from(new Set(hits.map((h) => h.documentId))),
        duration_ms: durationMs,
        cache_hit: false,
      })
      .then(() => undefined, () => undefined);

    return {
      query: data.query,
      hits,
      contextText,
      durationMs,
      cacheHit: false,
    };
  });

export const listKnowledgeQueryLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KnowledgeQueryLog[]> => {
    const { data, error } = await context.supabase
      .from("knowledge_query_logs")
      .select("id,query,top_score,document_ids,duration_ms,cache_hit,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      query: r.query as string,
      topScore: (r.top_score as number) ?? null,
      documentIds: (r.document_ids as string[]) ?? [],
      durationMs: (r.duration_ms as number) ?? null,
      cacheHit: Boolean(r.cache_hit),
      createdAt: r.created_at as string,
    }));
  });
