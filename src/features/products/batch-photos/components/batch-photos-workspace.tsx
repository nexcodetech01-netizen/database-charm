import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Search,
  SkipForward,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/layout/state-views";
import { cn } from "@/lib/utils";
import { moveItem } from "../lib/batch-photos";
import {
  attachPhotosToProduct,
  listPhotoCandidates,
  type PhotoCandidate,
} from "../lib/batch-photos.service";
import { MAX_ORIGINAL_MB } from "../../lib/compress-photo";

/*
 * Fotos por peça (fila).
 *
 * A pessoa escolhe a categoria (ex.: Vestuário) e a tela mostra, uma por vez,
 * as peças sem foto. Ela coloca as fotos DAQUELA peça e clica em "Salvar e
 * próxima". Nada é adivinhado — a versão anterior juntava fotos pela ordem
 * dos arquivos e sugeria qualquer produto sem foto (cabo, perfume...), o que
 * misturava tudo.
 */

interface Photo {
  id: string;
  file: File;
  url: string;
}

const ALL = "__all__";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

let seq = 0;
const uid = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function BatchPhotosWorkspace({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const candidatesQ = useQuery({
    queryKey: ["batch-photos-candidates", companyId],
    queryFn: () => listPhotoCandidates(companyId),
    enabled: !!companyId,
  });
  const candidates = useMemo(() => candidatesQ.data ?? [], [candidatesQ.data]);

  // Categorias que existem entre os produtos; abre em "Vestuário" se houver.
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of candidates) if (c.categoryId && c.categoryName) map.set(c.categoryId, c.categoryName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [candidates]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  useEffect(() => {
    if (categoryId !== null || categories.length === 0) return;
    const vest = categories.find(([, name]) => normalize(name).includes("vestuario"));
    setCategoryId(vest ? vest[0] : ALL);
  }, [categories, categoryId]);

  const [onlyWithoutPhoto, setOnlyWithoutPhoto] = useState(true);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [search, setSearch] = useState("");
  // Peças salvas/puladas nesta sessão (somem da fila "sem foto" na hora).
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  const queue = useMemo(() => {
    const q = normalize(search.trim());
    return candidates
      .filter((c) => !categoryId || categoryId === ALL || c.categoryId === categoryId)
      .filter((c) => !onlyWithoutPhoto || (!c.hasPhoto && !doneIds.has(c.id)) || doneIds.has(c.id))
      .filter((c) => !onlyInStock || c.stock > 0)
      .filter((c) => !q || normalize(`${c.name} ${c.sku ?? ""} ${c.variant}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  }, [candidates, categoryId, onlyWithoutPhoto, onlyInStock, search, doneIds]);

  const pendingCount = queue.filter((c) => !doneIds.has(c.id)).length;

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  // Com fotos ainda não salvas, a peça fica "presa": mudar filtro/busca não
  // troca de peça (antes as fotos iam parar em outro produto ao salvar).
  const pinned = photos.length > 0 ? (candidates.find((c) => c.id === currentId) ?? null) : null;
  const current = pinned ?? queue.find((c) => c.id === currentId) ?? null;

  // Sem peça escolhida (ou ela saiu da fila): vai para a primeira pendente.
  useEffect(() => {
    if (current) return;
    const next = queue.find((c) => !doneIds.has(c.id) && !skippedIds.has(c.id)) ?? null;
    setCurrentId(next?.id ?? null);
  }, [queue, current, doneIds, skippedIds]);

  const [coverIndex, setCoverIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function clearPhotos() {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setCoverIndex(0);
  }

  function selectProduct(id: string) {
    if (saving) return;
    if (photos.length > 0 && id !== currentId) {
      if (!window.confirm("As fotos colocadas nesta peça ainda não foram salvas. Trocar mesmo assim?")) return;
    }
    clearPhotos();
    setCurrentId(id);
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list || list.length === 0) return;
    const valid: Photo[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED.includes(f.type)) {
        toast.error(`Formato não suportado: ${f.name}`);
        continue;
      }
      if (f.size > MAX_ORIGINAL_MB * 1024 * 1024) {
        toast.error(`${f.name} é muito grande (máx. ${MAX_ORIGINAL_MB} MB)`);
        continue;
      }
      valid.push({ id: uid(), file: f, url: URL.createObjectURL(f) });
    }
    if (valid.length > 0) setPhotos((prev) => [...prev, ...valid]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const p = prev[index];
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((_, i) => i !== index);
    });
    setCoverIndex((c) => (index === c ? 0 : index < c ? c - 1 : c));
  }

  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    setPhotos((prev) => moveItem(prev, index, to));
    setCoverIndex((c) => (c === index ? to : c === to ? index : c));
  }

  function goNext(fromId: string) {
    const idx = queue.findIndex((c) => c.id === fromId);
    const after = [...queue.slice(idx + 1), ...queue.slice(0, Math.max(0, idx))];
    const next = after.find((c) => !doneIds.has(c.id) && c.id !== fromId && !skippedIds.has(c.id));
    setCurrentId(next?.id ?? null);
  }

  async function saveAndNext() {
    if (!current || photos.length === 0 || saving) return;
    setSaving(true);
    try {
      const n = await attachPhotosToProduct({
        companyId,
        productId: current.id,
        files: photos.map((p) => p.file),
        coverIndex,
      });
      toast.success(`${n} foto(s) salva(s) em ${current.name}`);
      setDoneIds((prev) => new Set(prev).add(current.id));
      clearPhotos();
      goNext(current.id);
      void qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar as fotos");
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    if (!current || saving) return;
    if (photos.length > 0 && !window.confirm("Descartar as fotos colocadas e pular esta peça?")) return;
    clearPhotos();
    setSkippedIds((prev) => new Set(prev).add(current.id));
    goNext(current.id);
  }

  // Colar (Ctrl+V) uma imagem copiada também funciona.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const doneCount = doneIds.size;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <div>
        <Link
          to="/produtos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Produtos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Fotos por peça</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Escolha a categoria, coloque as fotos da peça que aparece e clique em{" "}
          <strong>Salvar e próxima</strong>. Fotos grandes são reduzidas sozinhas.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId ?? ALL} onValueChange={(v) => setCategoryId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as categorias</SelectItem>
                {categories.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-search">Buscar peça</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="bp-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex.: nike preta gg"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={onlyWithoutPhoto} onCheckedChange={setOnlyWithoutPhoto} />
              Só sem foto
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={onlyInStock} onCheckedChange={setOnlyInStock} />
              Só com estoque
            </label>
          </div>
        </CardContent>
      </Card>

      {candidatesQ.isError ? (
        <ErrorState
          title="Não foi possível carregar os produtos"
          description="Sem a lista de produtos não dá para ligar as fotos. Tente de novo."
          onRetry={() => void candidatesQ.refetch()}
        />
      ) : null}

      {candidatesQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando peças…
        </div>
      ) : null}

      {!candidatesQ.isLoading && !candidatesQ.isError ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Peça atual */}
          <Card className="order-1">
            <CardContent className="space-y-4 p-4 sm:p-5">
              {current ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Peça atual
                      </p>
                      <h2 className="mt-1 text-xl font-semibold leading-tight">{current.name}</h2>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {current.brand ? <Badge variant="secondary">{current.brand}</Badge> : null}
                        {current.color ? <Badge variant="secondary">{current.color}</Badge> : null}
                        {current.size ? (
                          <Badge className="bg-primary text-primary-foreground">Tam. {current.size}</Badge>
                        ) : null}
                        {current.sku ? <Badge variant="outline">{current.sku}</Badge> : null}
                        {current.hasPhoto && !doneIds.has(current.id) ? (
                          <Badge variant="outline">Já tem {current.photoCount || 1} foto(s)</Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {doneCount} feita(s) · {pendingCount} na fila
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      addFiles(e.dataTransfer.files);
                    }}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                      dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-muted/40",
                    )}
                  >
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="font-medium">Coloque as fotos desta peça</span>
                    <span className="text-xs text-muted-foreground">
                      Toque para escolher, arraste ou cole (Ctrl+V) · JPG, PNG ou WebP
                    </span>
                  </button>

                  {photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {photos.map((p, i) => (
                        <div key={p.id} className="space-y-1.5">
                          <div
                            className={cn(
                              "relative aspect-square overflow-hidden rounded-lg border-2",
                              i === coverIndex ? "border-primary" : "border-transparent",
                            )}
                          >
                            <img src={p.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setCoverIndex(i)}
                              className={cn(
                                "absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                i === coverIndex
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-black/55 text-white hover:bg-black/70",
                              )}
                              aria-label="Usar como capa"
                            >
                              <Star className="h-3 w-3" /> {i === coverIndex ? "Capa" : "Capa?"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                              aria-label="Remover foto"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={i === 0}
                              onClick={() => move(i, -1)}
                              aria-label="Mover para a esquerda"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground">{i + 1}ª</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={i === photos.length - 1}
                              onClick={() => move(i, 1)}
                              aria-label="Mover para a direita"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={skip} disabled={saving}>
                      <SkipForward className="mr-1.5 h-4 w-4" /> Pular esta peça
                    </Button>
                    <Button type="button" onClick={saveAndNext} disabled={saving || photos.length === 0}>
                      {saving ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      )}
                      Salvar e próxima
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="font-medium">
                    {queue.length === 0 ? "Nenhuma peça nesta seleção" : "Fila concluída"}
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {queue.length === 0
                      ? "Troque a categoria ou desligue “Só sem foto” para ver mais peças."
                      : `${doneCount} peça(s) com foto nesta sessão. Peças puladas continuam na lista ao lado.`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fila */}
          <Card className="order-2">
            <CardContent className="p-2">
              <p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fila ({queue.length})
              </p>
              <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto">
                {queue.map((c) => (
                  <QueueItem
                    key={c.id}
                    item={c}
                    active={c.id === currentId}
                    done={doneIds.has(c.id)}
                    skipped={skippedIds.has(c.id)}
                    onClick={() => selectProduct(c.id)}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function QueueItem({
  item,
  active,
  done,
  skipped,
  onClick,
}: {
  item: PhotoCandidate;
  active: boolean;
  done: boolean;
  skipped: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          active ? "bg-primary/10 text-foreground" : "hover:bg-muted",
          done && "opacity-60",
        )}
      >
        <span className="mt-0.5 w-4 shrink-0">
          {done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
          {!done && skipped ? <SkipForward className="h-4 w-4 text-muted-foreground" /> : null}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 leading-snug">{item.name}</span>
          {item.size || item.color ? (
            <span className="text-xs text-muted-foreground">
              {[item.color, item.size ? `Tam. ${item.size}` : null].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
