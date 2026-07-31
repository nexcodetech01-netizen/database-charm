import { useQuery } from "@tanstack/react-query";
import { getKnowledgeStats } from "@/lib/knowledge.functions";
import type { KnowledgeStats } from "../types";

export function useKnowledgeStats() {
  return useQuery<KnowledgeStats>({
    queryKey: ["knowledge", "stats"],
    queryFn: () => getKnowledgeStats(),
    staleTime: 30_000,
  });
}
