
CREATE EXTENSION IF NOT EXISTS vector;

-- Documentos
CREATE TABLE public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  author text,
  version text NOT NULL DEFAULT '1.0',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active', -- active | inactive
  file_type text NOT NULL DEFAULT 'text', -- pdf | docx | txt | md | text
  file_name text,
  file_size integer,
  content_hash text,
  chunk_count integer NOT NULL DEFAULT 0,
  index_status text NOT NULL DEFAULT 'pending', -- pending | indexing | indexed | error
  index_error text,
  indexed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_documents_company_idx
  ON public.knowledge_documents (company_id, status);
CREATE INDEX knowledge_documents_category_idx
  ON public.knowledge_documents (company_id, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents tenant read"
  ON public.knowledge_documents FOR SELECT TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "knowledge_documents tenant insert"
  ON public.knowledge_documents FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "knowledge_documents tenant update"
  ON public.knowledge_documents FOR UPDATE TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "knowledge_documents tenant delete"
  ON public.knowledge_documents FOR DELETE TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));

-- Chunks
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_estimate integer NOT NULL DEFAULT 0,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_chunks_document_idx
  ON public.knowledge_chunks (document_id, chunk_index);
CREATE INDEX knowledge_chunks_company_idx
  ON public.knowledge_chunks (company_id);
CREATE INDEX knowledge_chunks_embedding_idx
  ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_chunks tenant read"
  ON public.knowledge_chunks FOR SELECT TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "knowledge_chunks tenant insert"
  ON public.knowledge_chunks FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "knowledge_chunks tenant delete"
  ON public.knowledge_chunks FOR DELETE TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));

-- Logs de consulta
CREATE TABLE public.knowledge_query_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query text NOT NULL,
  top_score real,
  document_ids uuid[] NOT NULL DEFAULT '{}',
  duration_ms integer,
  cache_hit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_query_logs_company_created_idx
  ON public.knowledge_query_logs (company_id, created_at DESC);

GRANT SELECT, INSERT ON public.knowledge_query_logs TO authenticated;
GRANT ALL ON public.knowledge_query_logs TO service_role;
ALTER TABLE public.knowledge_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_query_logs tenant read"
  ON public.knowledge_query_logs FOR SELECT TO authenticated
  USING (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "knowledge_query_logs tenant insert"
  ON public.knowledge_query_logs FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.knowledge_documents_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_documents_touch_updated_at();

-- Função de busca vetorial escopada por empresa
CREATE OR REPLACE FUNCTION public.knowledge_match_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 5,
  min_similarity real DEFAULT 0.0
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_category text,
  chunk_index integer,
  content text,
  similarity real
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.title AS document_title,
    d.category AS document_category,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::real AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE
    c.embedding IS NOT NULL
    AND d.status = 'active'
    AND c.company_id IN (SELECT current_company_id FROM public.profiles WHERE id = auth.uid())
    AND (1 - (c.embedding <=> query_embedding))::real >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.knowledge_match_chunks(vector, integer, real) TO authenticated;
