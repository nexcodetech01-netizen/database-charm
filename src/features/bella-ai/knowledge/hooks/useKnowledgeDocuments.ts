import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KnowledgeManager } from "../KnowledgeManager";
import type {
  KnowledgeDocStatus,
  KnowledgeDocument,
  KnowledgeUploadInput,
} from "../types";

const LIST_KEY = ["knowledge", "documents"] as const;

export function useKnowledgeDocuments() {
  const qc = useQueryClient();
  const list = useQuery<KnowledgeDocument[]>({
    queryKey: LIST_KEY,
    queryFn: () => KnowledgeManager.list(),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const upload = useMutation({
    mutationFn: (input: KnowledgeUploadInput) => KnowledgeManager.upload(input),
    onSuccess: () => {
      toast.success("Documento indexado com sucesso.");
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Falha ao indexar."),
  });

  const reindex = useMutation({
    mutationFn: (args: { id: string; content: string }) =>
      KnowledgeManager.reindex(args.id, args.content),
    onSuccess: () => {
      toast.success("Documento reindexado.");
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Falha ao reindexar."),
  });

  const remove = useMutation({
    mutationFn: (args: { id: string; companyId: string }) =>
      KnowledgeManager.remove(args.id, args.companyId),
    onSuccess: () => {
      toast.success("Documento removido.");
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Falha ao remover."),
  });

  const setStatus = useMutation({
    mutationFn: (args: { id: string; status: KnowledgeDocStatus }) =>
      KnowledgeManager.setStatus(args.id, args.status),
    onSuccess: invalidate,
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar status."),
  });

  return { list, upload, reindex, remove, setStatus };
}
