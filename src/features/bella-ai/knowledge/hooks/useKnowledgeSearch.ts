import { useCallback, useState } from "react";
import { toast } from "sonner";
import { KnowledgeManager } from "../KnowledgeManager";
import type { KnowledgeSearchResult } from "../types";

export function useKnowledgeSearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KnowledgeSearchResult | null>(null);

  const search = useCallback(async (query: string, topK = 5) => {
    if (!query.trim()) return null;
    setLoading(true);
    try {
      const r = await KnowledgeManager.search(query, { topK });
      setResult(r);
      return r;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na busca.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, result, loading };
}
