import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { EmptyState, PageLayout } from "@/components/layout";
import { useKnowledgeDocuments } from "@/features/bella-ai/knowledge/hooks/useKnowledgeDocuments";
import { useKnowledgeStats } from "@/features/bella-ai/knowledge/hooks/useKnowledgeStats";
import { useKnowledgeSearch } from "@/features/bella-ai/knowledge/hooks/useKnowledgeSearch";
import type {
  KnowledgeDocument,
  KnowledgeFileType,
} from "@/features/bella-ai/knowledge";

import { requirePermission } from "@/features/rbac";

export const Route = createFileRoute("/_authenticated/bella-conhecimento")({
  beforeLoad: requirePermission("bella_ia.view"),
  head: () => ({
    meta: [
      { title: "Conhecimento Bella · NexOS" },
      {
        name: "description",
        content:
          "Base de conhecimento consultada pela Bella IA — catálogos, políticas, manuais e FAQs indexados por busca semântica.",
      },
      { property: "og:title", content: "Conhecimento Bella · NexOS" },
      {
        property: "og:description",
        content: "Documentos internos indexados para a Bella IA responder com contexto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KnowledgePage,
});

const CATEGORIES = ["Política", "Manual", "Catálogo", "FAQ", "Procedimento", "Outro"];

function KnowledgePage() {
  const { list, upload, reindex, remove, setStatus } = useKnowledgeDocuments();
  const stats = useKnowledgeStats();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const searchApi = useKnowledgeSearch();

  const documents = list.data ?? [];

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return documents;
    return documents.filter((d) => (d.category ?? "Outro") === categoryFilter);
  }, [documents, categoryFilter]);

  const s = stats.data;

  return (
    <PageLayout
      icon={BookOpen}
      title="Conhecimento Bella"
      description="Documentos internos consultados pela Bella IA via busca semântica (RAG)."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
          </Button>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Novo documento
              </Button>
            </DialogTrigger>
            <UploadDialog
              onClose={() => setUploadOpen(false)}
              onSubmit={async (payload) => {
                await upload.mutateAsync(payload);
                setUploadOpen(false);
              }}
              submitting={upload.isPending}
            />
          </Dialog>
        </>
      }
      kpis={
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiChip label="Documentos" value={s?.totalDocuments ?? 0} icon={FileText} tone="text-primary bg-primary/10" />
          <KpiChip label="Indexados" value={s?.indexedDocuments ?? 0} icon={CheckCircle2} tone="text-emerald-500 bg-emerald-500/10" />
          <KpiChip label="Chunks" value={s?.totalChunks ?? 0} icon={Database} tone="text-blue-500 bg-blue-500/10" />
          <KpiChip label="Pendentes" value={(s?.pendingDocuments ?? 0) + (s?.errorDocuments ?? 0)} icon={Clock} tone="text-amber-500 bg-amber-500/10" />
        </div>
      }
      aside={
        <SearchPanel
          query={query}
          onQueryChange={setQuery}
          onSearch={() => searchApi.search(query)}
          loading={searchApi.loading}
          result={searchApi.result}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 p-2">
        <Button
          variant={categoryFilter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
        >
          Todas
        </Button>
        {CATEGORIES.map((c) => (
          <Button
            key={c}
            variant={categoryFilter === c ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCategoryFilter(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Documentos</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cada documento é dividido em trechos e indexado por embeddings.
            </p>
          </div>
          <Badge variant="outline" className="text-[11px]">
            {filtered.length} {filtered.length === 1 ? "item" : "itens"}
          </Badge>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nenhum documento indexado ainda"
              description="Envie manuais, políticas, catálogos ou FAQs para que a Bella IA possa consultá-los."
              action={
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="mr-1.5 h-4 w-4" /> Enviar documento
                </Button>
              }
              className="py-16"
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onReindex={(content) => reindex.mutateAsync({ id: doc.id, content })}
                  onDelete={() => remove.mutateAsync({ id: doc.id, companyId: doc.companyId })}
                  onToggle={(status) => setStatus.mutateAsync({ id: doc.id, status })}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}

/* -------------------- subcomponents -------------------- */

function KpiChip({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  onReindex,
  onDelete,
  onToggle,
}: {
  doc: KnowledgeDocument;
  onReindex: (content: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onToggle: (status: "active" | "inactive") => Promise<unknown>;
}) {
  const [reindexOpen, setReindexOpen] = useState(false);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{doc.title}</p>
          <StatusBadge doc={doc} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {doc.category ? <span>{doc.category}</span> : null}
          <span>·</span>
          <span>v{doc.version}</span>
          <span>·</span>
          <span>{doc.chunkCount} trechos</span>
          <span>·</span>
          <span>Atualizado {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: ptBR })}</span>
          {doc.tags.length > 0 ? (
            <>
              <span>·</span>
              <span className="truncate">{doc.tags.join(", ")}</span>
            </>
          ) : null}
        </div>
        {doc.indexError ? (
          <p className="mt-1 text-[11px] text-destructive">{doc.indexError}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Switch
            checked={doc.status === "active"}
            onCheckedChange={(v) => onToggle(v ? "active" : "inactive")}
            aria-label="Ativar documento"
          />
          <span className="text-[11px] text-muted-foreground">
            {doc.status === "active" ? "Ativo" : "Inativo"}
          </span>
        </div>
        <Dialog open={reindexOpen} onOpenChange={setReindexOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reindexar
            </Button>
          </DialogTrigger>
          <ReindexDialog
            doc={doc}
            onClose={() => setReindexOpen(false)}
            onSubmit={async (content) => {
              await onReindex(content);
              setReindexOpen(false);
            }}
          />
        </Dialog>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Remover "${doc.title}"? Esta ação não pode ser desfeita.`)) {
              void onDelete();
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

function StatusBadge({ doc }: { doc: KnowledgeDocument }) {
  if (doc.indexStatus === "indexed") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-[10px]">
        Indexado
      </Badge>
    );
  }
  if (doc.indexStatus === "error") {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px]">
        <AlertTriangle className="mr-1 h-3 w-3" /> Erro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[10px]">
      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Indexando
    </Badge>
  );
}

function SearchPanel({
  query,
  onQueryChange,
  onSearch,
  loading,
  result,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
  result: ReturnType<typeof useKnowledgeSearch>["result"];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Testar busca
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Simule uma pergunta e veja quais trechos a Bella receberia como contexto.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Ex.: Qual o prazo de troca?"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
          <Button size="sm" onClick={onSearch} disabled={loading || query.trim().length < 2}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {result ? (
          result.hits.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum trecho relevante encontrado.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                {result.hits.length} trechos · {result.durationMs} ms
              </p>
              {result.hits.map((h, i) => (
                <div key={h.chunkId} className="rounded-md border border-border/60 bg-muted/30 p-2">
                  <p className="text-[11px] font-semibold text-primary">
                    [{i + 1}] {h.documentTitle}
                    <span className="ml-1 font-normal text-muted-foreground">
                      · {(h.similarity * 100).toFixed(0)}%
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-4 text-[12px] text-foreground/80">{h.content}</p>
                </div>
              ))}
            </div>
          )
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Documentos completos nunca são enviados ao modelo — apenas os trechos vencedores.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------- dialogs -------------------- */

interface UploadPayload {
  title: string;
  category: string | null;
  author: string | null;
  version: string;
  tags: string[];
  fileType: KnowledgeFileType;
  fileName: string | null;
  fileSize: number | null;
  content: string;
}

function UploadDialog({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (payload: UploadPayload) => Promise<void>;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Manual");
  const [author, setAuthor] = useState("");
  const [version, setVersion] = useState("1.0");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileType, setFileType] = useState<KnowledgeFileType>("text");
  const [readError, setReadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setReadError(null);
    setFileName(file.name);
    setFileSize(file.size);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (ext === "pdf") setFileType("pdf");
    else if (ext === "docx") setFileType("docx");
    else if (ext === "md") setFileType("md");
    else if (ext === "txt") setFileType("txt");
    else setFileType("text");

    if (ext === "txt" || ext === "md" || file.type.startsWith("text/")) {
      try {
        const text = await file.text();
        setContent(text);
      } catch {
        setReadError("Não foi possível ler o arquivo.");
      }
    } else {
      setReadError(
        "Extração automática de PDF/DOCX ainda não disponível. Cole o conteúdo abaixo.",
      );
    }
  }

  const canSubmit =
    title.trim().length > 0 && content.trim().length > 20 && !submitting;

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Novo documento</DialogTitle>
        <DialogDescription>
          O texto é dividido em trechos e indexado por embeddings. Nada é enviado ao modelo além dos trechos vencedores durante uma consulta.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="k-title">Título *</Label>
            <Input id="k-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="k-category">Categoria</Label>
            <select
              id="k-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="k-author">Autor</Label>
            <Input id="k-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="k-version">Versão</Label>
            <Input id="k-version" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="k-tags">Tags (separadas por vírgula)</Label>
            <Input id="k-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="troca, pós-venda" />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Arquivo (opcional — .txt / .md lidos automaticamente)</Label>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx,text/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" /> Selecionar arquivo
            </Button>
            {fileName ? (
              <span className="text-xs text-muted-foreground truncate">
                {fileName} · {((fileSize ?? 0) / 1024).toFixed(1)} KB
              </span>
            ) : null}
          </div>
          {readError ? (
            <p className="text-[11px] text-amber-500">{readError}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="k-content">Conteúdo *</Label>
          <Textarea
            id="k-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder="Cole aqui o texto do manual, política, FAQ, catálogo…"
          />
          <p className="text-[11px] text-muted-foreground">
            {content.length.toLocaleString("pt-BR")} caracteres
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              title: title.trim(),
              category: category || null,
              author: author.trim() || null,
              version: version.trim() || "1.0",
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              fileType,
              fileName,
              fileSize,
              content,
            })
          }
        >
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          Indexar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ReindexDialog({
  doc,
  onClose,
  onSubmit,
}: {
  doc: KnowledgeDocument;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Reindexar "{doc.title}"</DialogTitle>
        <DialogDescription>
          Cole novamente o texto atualizado para regenerar os trechos e embeddings.
        </DialogDescription>
      </DialogHeader>
      <Textarea
        rows={12}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Conteúdo atualizado…"
      />
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          disabled={content.trim().length < 20 || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit(content);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          Reindexar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
