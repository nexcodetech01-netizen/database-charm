import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  Collection,
  CollectionInsert,
  CollectionStatus,
  CollectionUpdate,
  CtaMode,
} from "../types";
import { COLLECTION_STATUS_OPTIONS, CTA_MODE_OPTIONS } from "../types";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  editing?: Collection | null;
  onSubmit: (
    values:
      | { mode: "create"; input: Omit<CollectionInsert, "slug"> }
      | { mode: "update"; id: string; patch: CollectionUpdate; rename: boolean },
  ) => Promise<void> | void;
}

export function CollectionFormDialog({
  open,
  onOpenChange,
  companyId,
  editing,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState<CollectionStatus>("active");
  const [scheduledAt, setScheduledAt] = useState("");
  const [ctaMode, setCtaMode] = useState<CtaMode>("whatsapp");
  const [showPrice, setShowPrice] = useState(true);
  const [showInstallments, setShowInstallments] = useState(true);
  const [showStock, setShowStock] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const src = editing as (Collection & Partial<{
        cta_mode: CtaMode;
        show_price: boolean;
        show_installments: boolean;
        show_stock: boolean;
        show_brand: boolean;
      }>) | null | undefined;
      setName(src?.name ?? "");
      setDescription(src?.description ?? "");
      setCoverUrl(src?.cover_url ?? "");
      setStatus((src?.status as CollectionStatus) ?? "active");
      setScheduledAt(
        src?.scheduled_at
          ? new Date(src.scheduled_at).toISOString().slice(0, 16)
          : "",
      );
      setCtaMode((src?.cta_mode as CtaMode) ?? "whatsapp");
      setShowPrice(src?.show_price ?? true);
      setShowInstallments(src?.show_installments ?? true);
      setShowStock(src?.show_stock ?? true);
      setShowBrand(src?.show_brand ?? true);
    }
  }, [open, editing]);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const base = {
        name: name.trim(),
        description: description.trim() || null,
        cover_url: coverUrl.trim() || null,
        status,
        scheduled_at:
          status === "scheduled" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
        cta_mode: ctaMode,
        show_price: showPrice,
        show_installments: showInstallments,
        show_stock: showStock,
        show_brand: showBrand,
      } as unknown as CollectionUpdate;
      if (editing) {
        const renamed = editing.name !== (base as { name: string }).name;
        await onSubmit({
          mode: "update",
          id: editing.id,
          patch: base,
          rename: renamed,
        });
      } else {
        await onSubmit({
          mode: "create",
          input: { company_id: companyId, ...(base as object) } as Omit<CollectionInsert, "slug">,
        });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar coleção" : "Nova coleção"}
          </DialogTitle>
          <DialogDescription>
            Agrupe produtos existentes em uma coleção compartilhável.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="col-name">Nome</Label>
            <Input
              id="col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Verão 2026"
            />
          </div>
          <div>
            <Label htmlFor="col-desc">Descrição</Label>
            <Textarea
              id="col-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>
          <div>
            <Label htmlFor="col-cover">Capa (URL)</Label>
            <Input
              id="col-cover"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CollectionStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLECTION_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {status === "scheduled" && (
              <div>
                <Label htmlFor="col-sched">Agendar para</Label>
                <Input
                  id="col-sched"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <Label>Ação principal</Label>
            <Select value={ctaMode} onValueChange={(v) => setCtaMode(v as CtaMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CTA_MODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {CTA_MODE_OPTIONS.find((o) => o.value === ctaMode)?.description}
            </p>
          </div>

          <div>
            <Label>Exibição pública</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { key: "price", label: "Mostrar preço", value: showPrice, set: setShowPrice },
                { key: "installments", label: "Mostrar parcelamento", value: showInstallments, set: setShowInstallments },
                { key: "stock", label: "Mostrar estoque", value: showStock, set: setShowStock },
                { key: "brand", label: "Mostrar marca", value: showBrand, set: setShowBrand },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm"
                >
                  <Checkbox
                    checked={opt.value}
                    onCheckedChange={(v) => opt.set(v === true)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? "Salvando…" : editing ? "Salvar" : "Criar coleção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
