import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/layout/state-views";
import { cn } from "@/lib/utils";
import { chunkPhotos, duplicatedAssignments, sortPhotos, suggestAssignments } from "../lib/batch-photos";
import {
  attachPhotosToProduct,
  listPhotoCandidates,
  type PhotoCandidate,
} from "../lib/batch-photos.service";

interface Photo {
  id: string;
  file: File;
  url: string;
}

interface Group {
  id: string;
  photos: Photo[];
  productId: string | null;
  status: "pending" | "saving" | "done" | "error";
  error?: string;
}

const NONE = "__none__";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 15;

let seq = 0;
const uid = () => `g${Date.now().toString(36)}${(seq++).toString(36)}`;

export function BatchPhotosWorkspace({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [perItem, setPerItem] = useState(3);
  const [coverIndex, setCoverIndex] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const candidatesQ = useQuery({
    queryKey: ["batch-photos-candidates", companyId],
    queryFn: () => listPhotoCandidates(companyId),
    enabled: !!companyId,
  });
  const candidates = candidatesQ.data ?? [];
  const withoutPhoto = useMemo(() => candidates.filter((c) => !c.hasPhoto), [candidates]);
  const withPhoto = useMemo(() => candidates.filter((c) => c.hasPhoto), [candidates]);
  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  // Libera as pré-visualizações ao sair da tela.
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  useEffect(
    () => () => groupsRef.current.forEach((g) => g.photos.forEach((p) => URL.revokeObjectURL(p.url))),
    [],
  );

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const valid: File[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED.includes(f.type)) {
        toast.error(`Formato não suportado: ${f.name}`);
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error(`${f.name} passa de ${MAX_MB} MB`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length === 0) return;
    const photos: Photo[] = sortPhotos(valid).map((file) => ({
      id: uid(),
      file,
      url: URL.createObjectURL(file),
    }));
    setGroups((prev) => {
      // Produtos já usados em grupos anteriores não são sugeridos de novo.
      const used = new Set(prev.map((g) => g.productId).filter(Boolean) as string[]);
      const chunks = chunkPhotos(photos, perItem);
      const suggestions = suggestAssignments(
        chunks.length,
        withoutPhoto.filter((c) => !used.has(c.id)),
      );
      return [
        ...prev,
        ...chunks.map((ph, i) => ({
          id: uid(),
          photos: ph,
          productId: suggestions[i],
          status: "pending" as const,
        })),
      ];
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  /** Move a foto uma casa; na ponta, passa para a peça vizinha. */
  function movePhoto(gi: number, pi: number, dir: -1 | 1) {
    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, photos: [...g.photos] }));
      const g = next[gi];
      const target = pi + dir;
      if (target >= 0 && target < g.photos.length) {
        [g.photos[pi], g.photos[target]] = [g.photos[target], g.photos[pi]];
        return next;
      }
      const [photo] = g.photos.splice(pi, 1);
      if (dir === -1) {
        if (gi === 0) return prev;
        next[gi - 1].photos.push(photo);
      } else if (gi === next.length - 1) {
        next.push({ id: uid(), photos: [photo], productId: null, status: "pending" });
      } else {
        next[gi + 1].photos.unshift(photo);
      }
      return next.filter((x) => x.photos.length > 0);
    });
  }

  function removePhoto(gi: number, pi: number) {
    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, photos: [...g.photos] }));
      const [photo] = next[gi].photos.splice(pi, 1);
      if (photo) URL.revokeObjectURL(photo.url);
      return next.filter((x) => x.photos.length > 0);
    });
  }

  function removeGroup(gi: number) {
    setGroups((prev) => {
      prev[gi]?.photos.forEach((p) => URL.revokeObjectURL(p.url));
      return prev.filter((_, i) => i !== gi);
    });
  }

  function setProduct(gi: number, value: string) {
    setGroups((prev) =>
      prev.map((g, i) => (i === gi ? { ...g, productId: value === NONE ? null : value } : g)),
    );
  }

  const duplicated = duplicatedAssignments(groups.map((g) => g.productId));
  const pending = groups.filter((g) => g.status !== "done");
  const ready = pending.filter((g) => g.productId);
  const unassigned = pending.filter((g) => !g.productId).length;

  async function saveAll() {
    if (saving || ready.length === 0) return;
    if (duplicated.size > 0) {
      toast.error("Há produto escolhido em mais de uma peça. Corrija antes de salvar.");
      return;
    }
    setSaving(true);
    setProgress({ done: 0, total: ready.length });
    let ok = 0;
    for (const g of ready) {
      setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, status: "saving", error: undefined } : x)));
      try {
        await attachPhotosToProduct({
          companyId,
          productId: g.productId!,
          files: g.photos.map((p) => p.file),
          coverIndex,
        });
        ok++;
        setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, status: "done" } : x)));
      } catch (err) {
        setGroups((prev) =>
          prev.map((x) =>
            x.id === g.id
              ? { ...x, status: "error", error: err instanceof Error ? err.message : "Falha no envio" }
              : x,
          ),
        );
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setSaving(false);
    await qc.invalidateQueries({ queryKey: ["products"] });
    await qc.invalidateQueries({ queryKey: ["batch-photos-candidates", companyId] });
    const failed = ready.length - ok;
    if (failed === 0) toast.success(`Fotos salvas em ${ok} produto(s).`);
    else toast.error(`${ok} salvo(s), ${failed} com erro. As com erro continuam na tela para tentar de novo.`);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/produtos">
              <ArrowLeft className="mr-1 h-4 w-4" /> Produtos
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Fotos em lote</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Selecione as fotos prontas de várias peças de uma vez. O sistema junta as fotos de cada
            peça e sugere o produto pela ordem do cadastro (os sem foto, do mais antigo para o mais novo).
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1">
            <p className="text-sm font-medium">Como mandar</p>
            <p className="text-xs text-muted-foreground">
              Fotos na ordem de cada peça (ex.: dobrada, frente, costas). Se uma peça tiver menos fotos,
              use as setas para passar a foto para a peça certa.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fotos por peça</Label>
            <Select
              value={String(perItem)}
              onValueChange={(v) => {
                setPerItem(Number(v));
                if (coverIndex >= Number(v)) setCoverIndex(0);
              }}
              disabled={groups.length > 0}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {n === 1 ? "foto" : "fotos"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Capa do produto</Label>
            <Select value={String(coverIndex)} onValueChange={(v) => setCoverIndex(Number(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: perItem }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {i + 1}ª foto da peça
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        disabled={saving}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:bg-muted/50 disabled:opacity-60"
      >
        <ImagePlus className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">
          {groups.length === 0 ? "Escolher fotos" : "Adicionar mais fotos"}
        </span>
        <span className="text-xs text-muted-foreground">
          Toque para escolher ou arraste para cá · JPG, PNG ou WebP
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {candidatesQ.isError ? (
        <ErrorState
          title="Não foi possível carregar os produtos"
          description="Sem a lista de produtos não dá para ligar as fotos. Tente de novo."
          onRetry={() => void candidatesQ.refetch()}
        />
      ) : null}

      {groups.length > 0 && !candidatesQ.isLoading && withoutPhoto.length < groups.length ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Há {groups.length} peça(s) e {withoutPhoto.length} produto(s) sem foto. Cadastre os que
          faltam ou escolha o produto manualmente.
        </p>
      ) : null}

      <div className="space-y-3">
        {groups.map((g, gi) => {
          const product = g.productId ? byId.get(g.productId) : undefined;
          const isDup = !!g.productId && duplicated.has(g.productId);
          return (
            <Card
              key={g.id}
              className={cn(
                g.status === "done" && "border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20",
                g.status === "error" && "border-destructive/60",
              )}
            >
              <CardContent className="space-y-3 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    Peça {gi + 1}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {g.photos.length} {g.photos.length === 1 ? "foto" : "fotos"}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    {g.status === "saving" ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
                      </span>
                    ) : g.status === "done" ? (
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Salvo
                      </span>
                    ) : g.status === "error" ? (
                      <span className="text-destructive">{g.error}</span>
                    ) : null}
                    {g.status !== "done" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground"
                        onClick={() => removeGroup(gi)}
                        disabled={saving}
                      >
                        Remover peça
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {g.photos.map((p, pi) => (
                    <div key={p.id} className="relative w-28 shrink-0 sm:w-32">
                      <img
                        src={p.url}
                        alt={`Peça ${gi + 1}, foto ${pi + 1}`}
                        className="aspect-square w-full rounded-lg border border-border object-cover"
                      />
                      {pi === Math.min(coverIndex, g.photos.length - 1) ? (
                        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          <Star className="h-3 w-3" /> Capa
                        </span>
                      ) : null}
                      {g.status !== "done" ? (
                        <>
                          <button
                            type="button"
                            aria-label="Tirar esta foto"
                            className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white hover:bg-black"
                            onClick={() => removePhoto(gi, pi)}
                            disabled={saving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <div className="mt-1 flex justify-between">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Mover para a esquerda"
                              onClick={() => movePhoto(gi, pi, -1)}
                              disabled={saving || (gi === 0 && pi === 0)}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="self-center text-[11px] text-muted-foreground">{pi + 1}ª</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Mover para a direita"
                              onClick={() => movePhoto(gi, pi, 1)}
                              disabled={saving}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <Select
                    value={g.productId ?? NONE}
                    onValueChange={(v) => setProduct(gi, v)}
                    disabled={saving || g.status === "done"}
                  >
                    <SelectTrigger className={cn("w-full", isDup && "border-destructive")}>
                      <SelectValue placeholder="Escolha o produto" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value={NONE}>Não ligar a nenhum produto</SelectItem>
                      {withoutPhoto.length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>Sem foto (ordem do cadastro)</SelectLabel>
                          {[...withoutPhoto]
                            .sort((a, b) => a.created_at.localeCompare(b.created_at))
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {optionLabel(c)}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      ) : null}
                      {withPhoto.length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>Já têm foto (acrescentar)</SelectLabel>
                          {withPhoto.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {optionLabel(c)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ) : null}
                    </SelectContent>
                  </Select>
                  {isDup ? (
                    <p className="text-xs text-destructive">Este produto foi escolhido em outra peça também.</p>
                  ) : product?.hasPhoto && g.status !== "done" ? (
                    <p className="text-xs text-muted-foreground">
                      Este produto já tem foto: estas serão acrescentadas depois das atuais.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {groups.length > 0 ? (
        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-sm">
              {saving ? (
                <div className="space-y-1">
                  <p>
                    Enviando peça {Math.min(progress.done + 1, progress.total)} de {progress.total}…
                  </p>
                  <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="h-2" />
                </div>
              ) : pending.length === 0 ? (
                <p className="text-emerald-700 dark:text-emerald-400">Tudo salvo.</p>
              ) : (
                <p className="text-muted-foreground">
                  {ready.length} peça(s) prontas para salvar
                  {unassigned > 0 ? ` · ${unassigned} sem produto (não serão salvas)` : ""}
                </p>
              )}
            </div>
            {pending.length === 0 ? (
              <Button asChild>
                <Link to="/produtos">Ver produtos</Link>
              </Button>
            ) : (
              <Button onClick={() => void saveAll()} disabled={saving || ready.length === 0}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Salvar fotos
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function optionLabel(c: PhotoCandidate): string {
  return [c.name, c.variant, c.sku].filter(Boolean).join(" · ");
}
