import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Sparkles } from "lucide-react";
import type jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getInstallmentPlan } from "@/lib/format";
import { toCustomerReference } from "@/lib/customer-reference";
import { useCompanyBranding } from "@/features/settings/hooks/use-company-branding";
import { toast } from "sonner";

/* ---------- Types ---------- */

interface CatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  status: string | null;
  brand: string | null;
  stock: number | null;
  category_id: string | null;
  cover_image_path: string | null;
}

type SortKey = "name" | "price_asc" | "price_desc";

/* ---------- PDF save (browser + PWA) ---------- */

function isMobileOrPwaEnv(): boolean {
  if (typeof window === "undefined") return false;
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua);
  const isTouchOnly =
    (navigator.maxTouchPoints ?? 0) > 1 &&
    !window.matchMedia?.("(pointer: fine)").matches;
  return isStandalone || isMobileUA || isTouchOnly;
}

async function savePdfBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 60_000);

  if (isMobileOrPwaEnv()) {
    const file = new File([blob], filename, { type: "application/pdf" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && typeof nav.share === "function") {
      try {
        await nav.share({ files: [file], title: filename });
        cleanup();
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") {
          cleanup();
          return;
        }
      }
    }
    const opened = window.open(url, "_blank");
    if (!opened) {
      toast.message("Toque para abrir o PDF", {
        description: "Seu navegador bloqueou a nova aba. Permita pop-ups e tente novamente.",
      });
    }
    cleanup();
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1_000);
  cleanup();
}

/* ---------- Image helpers ---------- */

const SIGNED_URL_TTL = 60 * 10;

async function signPathsBatch(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data, error } = await supabase.storage
    .from("product-images")
    .createSignedUrls(paths, SIGNED_URL_TTL);
  if (error || !data) return map;
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

type LoadedImage = { data: string; w: number; h: number };

async function imageToDataUrl(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url, { cache: "force-cache", mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
    if (!data) return null;
    const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = data;
    });
    if (!dims || dims.w <= 0 || dims.h <= 0) return null;
    return { data, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

function detectImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  const head = dataUrl.slice(0, 40).toLowerCase();
  if (head.includes("image/png")) return "PNG";
  if (head.includes("image/webp")) return "WEBP";
  return "JPEG";
}

/** Crop cover 4:5 (portrait), always centered, never distorted. */
async function cropCoverToAspectAsync(
  loaded: LoadedImage,
  targetAspect: number,
): Promise<LoadedImage> {
  const srcAspect = loaded.w / loaded.h;
  let sw = loaded.w;
  let sh = loaded.h;
  let sx = 0;
  let sy = 0;
  if (srcAspect > targetAspect) {
    sw = loaded.h * targetAspect;
    sx = (loaded.w - sw) / 2;
  } else if (srcAspect < targetAspect) {
    sh = loaded.w / targetAspect;
    sy = (loaded.h - sh) / 2;
  }
  const MAX = 1400;
  const scale = Math.min(1, MAX / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * scale));
  const outH = Math.max(1, Math.round(sh * scale));

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = loaded.data;
  });
  if (!img) return loaded;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return loaded;
  ctx.fillStyle = "#f6f5f2";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  const data = canvas.toDataURL("image/jpeg", 0.92);
  return { data, w: outW, h: outH };
}

function fitTextEllipsis(
  doc: jsPDF,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const lines = doc.splitTextToSize(text, maxW) as string[];
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  let last = (result[maxLines - 1] ?? "").replace(/\s+$/, "");
  const ell = "…";
  while (last.length > 0 && doc.getTextWidth(last + ell) > maxW) {
    last = last.slice(0, -1).replace(/\s+$/, "");
  }
  result[maxLines - 1] = last + ell;
  return result;
}

/* ---------- Component ---------- */

export function CommercialCatalogWorkspace({
  companyId,
  onBack,
}: {
  companyId: string;
  onBack: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock">("in_stock");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [title, setTitle] = useState<string>("Catálogo Comercial");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string }>({
    value: 0,
    label: "",
  });

  const brandingQuery = useCompanyBranding(companyId);
  const branding = brandingQuery.data ?? null;

  const filtersQuery = useQuery({
    queryKey: ["commercial-catalog-filters", companyId],
    queryFn: async () => {
      const [cats, brands] = await Promise.all([
        supabase
          .from("product_categories")
          .select("id, name")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("products")
          .select("brand")
          .eq("company_id", companyId)
          .not("brand", "is", null),
      ]);
      const uniqueBrands = Array.from(
        new Set(
          (brands.data ?? [])
            .map((b) => (b.brand ?? "").trim())
            .filter((b) => b.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));
      return { categories: cats.data ?? [], brands: uniqueBrands };
    },
    enabled: Boolean(companyId),
    staleTime: 5 * 60_000,
  });

  const productsQuery = useQuery({
    queryKey: [
      "commercial-catalog-products",
      companyId,
      categoryId,
      brand,
      stockFilter,
      sortBy,
    ],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id,name,sku,price,status,brand,stock,category_id,cover_image_path")
        .eq("company_id", companyId)
        .eq("status", "active");
      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      if (brand !== "all") q = q.eq("brand", brand);
      if (stockFilter === "in_stock") q = q.gt("stock", 0);
      if (sortBy === "price_asc") q = q.order("price", { ascending: true, nullsFirst: false });
      else if (sortBy === "price_desc") q = q.order("price", { ascending: false, nullsFirst: false });
      else q = q.order("name", { ascending: true });
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as CatalogProduct[];
    },
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });

  const products = productsQuery.data ?? [];
  const totalPagesEst = useMemo(
    () => 1 + Math.max(1, Math.ceil(products.length / 6)),
    [products.length],
  );

  async function generatePdf() {
    if (products.length === 0 || generating) return;
    setGenerating(true);
    setProgress({ value: 4, label: "Preparando catálogo..." });
    try {
      await new Promise((r) => setTimeout(r, 30));

      const { default: JsPDF } = await import("jspdf");
      const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();  // 210
      const pageH = doc.internal.pageSize.getHeight(); // 297

      // A4 print-safe margins (~12mm). Grid escala automaticamente à área útil.
      const margin = 12;
      const gap = 8;
      const footerH = 12;


      // Grid 2x3 = 6 per page
      const cols = 2;
      const rows = 3;
      const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols;      // ~91mm
      const cellH = (pageH - margin * 2 - footerH - gap * (rows - 1)) / rows; // ~83mm

      // Photo: 4:5 (portrait). ~75% of card height.
      const imgH = cellH * 0.74;
      const imgW = imgH * (4 / 5);
      const targetAspect = imgW / imgH; // 4/5 = 0.8

      // Preload images
      const paths = Array.from(
        new Set(products.map((p) => p.cover_image_path).filter((v): v is string => !!v)),
      );
      setProgress({
        value: 10,
        label: paths.length > 0 ? `Carregando imagens (0 de ${paths.length})...` : "Preparando...",
      });
      const signed = await signPathsBatch(paths);
      const imageMap = new Map<string, LoadedImage | null>();
      const CONCURRENCY = 6;
      let i = 0;
      let done = 0;
      async function worker() {
        while (i < paths.length) {
          const idx = i++;
          const path = paths[idx];
          const url = signed.get(path) ?? null;
          const raw = url ? await imageToDataUrl(url) : null;
          let cropped: LoadedImage | null = null;
          try {
            cropped = raw ? await cropCoverToAspectAsync(raw, targetAspect) : null;
          } catch {
            cropped = raw;
          }
          imageMap.set(path, cropped);
          done++;
          const pct = 10 + Math.round((done / Math.max(1, paths.length)) * 55);
          setProgress({
            value: pct,
            label: `Carregando imagens (${done} de ${paths.length})...`,
          });
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      // Company logo
      let logoImg: LoadedImage | null = null;
      if (branding?.logoUrl) {
        try {
          logoImg = await imageToDataUrl(branding.logoUrl);
        } catch {
          /* ignore */
        }
      }

      const companyName =
        (branding?.company?.trade_name || branding?.company?.name || "").trim();
      const dateStr = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      /* ---------- COVER PAGE ---------- */
      setProgress({ value: 68, label: "Montando capa..." });

      // Cream background
      doc.setFillColor(246, 245, 242);
      doc.rect(0, 0, pageW, pageH, "F");

      // Top decorative line
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(margin, margin + 8, pageW - margin, margin + 8);

      // Small top label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("COLEÇÃO", pageW / 2, margin + 14, { align: "center" });

      // Logo centered
      const logoMaxH = 34;
      const logoMaxW = 90;
      let logoBottomY = pageH / 2 - 30;
      if (logoImg) {
        const aspect = logoImg.w / logoImg.h;
        let lw = logoMaxH * aspect;
        let lh = logoMaxH;
        if (lw > logoMaxW) {
          lw = logoMaxW;
          lh = lw / aspect;
        }
        const lx = (pageW - lw) / 2;
        const ly = pageH / 2 - lh - 18;
        try {
          doc.addImage(logoImg.data, detectImageFormat(logoImg.data), lx, ly, lw, lh, undefined, "FAST");
          logoBottomY = ly + lh;
        } catch {
          /* ignore */
        }
      }

      // Company name (big serif-style — helvetica bold as close)
      if (companyName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(28);
        doc.setTextColor(15, 23, 42);
        doc.text(companyName.toUpperCase(), pageW / 2, logoBottomY + 18, {
          align: "center",
        });
      }

      // Catalog title
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(71, 85, 105);
      doc.text(title || "Catálogo Comercial", pageW / 2, logoBottomY + 30, {
        align: "center",
      });

      // Thin separator
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      const sepY = logoBottomY + 40;
      doc.line(pageW / 2 - 20, sepY, pageW / 2 + 20, sepY);

      // Date
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(dateStr, pageW / 2, sepY + 8, { align: "center" });

      // Bottom decorative + paginação (capa = página 1)
      const totalPagesForFooter =
        1 + Math.max(1, Math.ceil(products.length / (cols * rows)));
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(margin, pageH - margin - 8, pageW - margin, pageH - margin - 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Gerado pelo NexOS", pageW / 2, pageH - margin - 2, {
        align: "center",
      });
      doc.text(
        `Página 1 de ${totalPagesForFooter}`,
        pageW - margin,
        pageH - margin - 2,
        { align: "right" },
      );


      /* ---------- PRODUCT PAGES ---------- */

      const perPage = cols * rows;
      const totalProductPages = Math.max(1, Math.ceil(products.length / perPage));
      setProgress({ value: 74, label: `Montando páginas (0 de ${totalProductPages})...` });

      for (let page = 0; page < totalProductPages; page++) {
        doc.addPage();
        const pct = 74 + Math.round(((page + 1) / totalProductPages) * 22);
        setProgress({
          value: pct,
          label: `Montando páginas (${page + 1} de ${totalProductPages})...`,
        });

        // White background
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageW, pageH, "F");

        const items = products.slice(page * perPage, (page + 1) * perPage);
        for (let idx = 0; idx < items.length; idx++) {
          const p = items[idx];
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const x = margin + col * (cellW + gap);
          const y = margin + row * (cellH + gap);

          // Photo container (centered horizontally in card)
          const imgX = x + (cellW - imgW) / 2;
          const imgY = y;
          doc.setFillColor(246, 245, 242);
          doc.rect(imgX, imgY, imgW, imgH, "F");
          const img = p.cover_image_path ? imageMap.get(p.cover_image_path) : null;
          if (img) {
            try {
              doc.addImage(
                img.data,
                detectImageFormat(img.data),
                imgX,
                imgY,
                imgW,
                imgH,
                undefined,
                "FAST",
              );
            } catch {
              /* keep placeholder */
            }
          } else {
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(8);
            doc.text("Sem imagem", imgX + imgW / 2, imgY + imgH / 2, {
              align: "center",
              baseline: "middle",
            });
          }

          // Text block
          const centerX = x + cellW / 2;
          const textBaseY = imgY + imgH + 6;


          // Referência do cliente (derivada do SKU — apenas apresentação).
          // Nome do produto é intencionalmente omitido: catálogo é voltado
          // ao cliente final e exibe somente foto, referência e preço.
          const reference = toCustomerReference(p.sku);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(
            reference ? `Ref. ${reference}` : "",
            centerX,
            textBaseY,
            { align: "center" },
          );

          // Price
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(37, 99, 235);
          const priceY = textBaseY + 8;
          doc.text(
            p.price != null ? formatCurrency(Number(p.price)) : "Sob consulta",
            centerX,
            priceY,
            { align: "center" },
          );

          // Installment plan (pt-BR): "ou 3x de R$ 33,33 sem juros"
          const plan = p.price != null ? getInstallmentPlan(Number(p.price)) : null;
          if (plan) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`ou ${plan.label}`, centerX, priceY + 5, { align: "center" });
          }

        }

        // Footer — legenda global de condições de pagamento + créditos
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, pageH - footerH, pageW - margin, pageH - footerH);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
          "Condições de Pagamento: Até R$ 100,00 parcela em 1x sem juros | Acima de R$ 100,00 em até 3x sem juros",
          pageW / 2,
          pageH - footerH + 4,
          { align: "center" },
        );

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        if (companyName) {
          doc.text(companyName, margin, pageH - 5);
        }
        doc.text("Gerado pelo NexOS", pageW / 2, pageH - 5, { align: "center" });
        doc.text(
          `Página ${page + 2} de ${totalProductPages + 1}`,
          pageW - margin,
          pageH - 5,
          { align: "right" },
        );

      }

      setProgress({ value: 98, label: "Finalizando..." });
      await new Promise((r) => setTimeout(r, 30));

      const filename = `catalogo-comercial-${new Date().toISOString().slice(0, 10)}.pdf`;
      const blob = doc.output("blob") as Blob;
      await savePdfBlob(blob, filename);
      setProgress({ value: 100, label: "Pronto!" });
    } catch (err) {
      console.error("[Catálogo Comercial] Falha:", err);
      const message =
        err instanceof Error ? err.message : "Erro desconhecido ao gerar o PDF.";
      toast.error("Não foi possível gerar o PDF", { description: message, duration: 8000 });
      setProgress({ value: 0, label: "" });
    } finally {
      setGenerating(false);
      setTimeout(() => setProgress({ value: 0, label: "" }), 600);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="h-8">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Voltar
          </Button>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Catálogo Comercial</h2>
              <p className="text-sm text-muted-foreground">
                Catálogo premium para apresentação aos clientes — capa institucional,
                6 produtos por página e visual estilo lookbook.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="h-8"
            onClick={generatePdf}
            disabled={products.length === 0 || generating}
            aria-busy={generating}
          >
            {generating ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="mr-2 h-3.5 w-3.5" />
            )}
            {generating ? "Gerando PDF..." : "Gerar PDF"}
          </Button>
        </div>
      </div>

      {generating || progress.value > 0 ? (
        <div className="rounded-lg border bg-card/60 p-3" role="status" aria-live="polite">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="font-medium text-foreground">
              {progress.label || "Preparando..."}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {Math.min(100, Math.max(0, Math.round(progress.value)))}%
            </span>
          </div>
          <Progress value={progress.value} className="h-1.5" />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Capa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título do catálogo</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Catálogo Comercial"
                  className="h-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A logo, o nome da empresa e a data são preenchidos automaticamente.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(filtersQuery.data?.categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Marca</Label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(filtersQuery.data?.brands ?? []).map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estoque</Label>
                <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as "all" | "in_stock")}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">Somente com estoque</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ordenar por</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nome (A–Z)</SelectItem>
                    <SelectItem value="price_asc">Menor preço</SelectItem>
                    <SelectItem value="price_desc">Maior preço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                <SummaryStat label="Produtos" value={String(products.length)} />
                <SummaryStat label="Por página" value="6" />
                <SummaryStat label="Páginas" value={String(totalPagesEst)} />
                <SummaryStat label="Formato" value="A4 retrato" />
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">O que o PDF traz</p>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed">
                  <li>• Capa com logo, nome da empresa e data de emissão</li>
                  <li>• 6 produtos por página em cards grandes</li>
                  <li>• Foto vertical 4:5 ocupando ~75% do card</li>
                  <li>• Nome (até 2 linhas) e preço destacado</li>
                  <li>• Sem SKU, sem margem e sem informações internas</li>
                  <li>• Rodapé "Gerado pelo NexOS" em todas as páginas</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-full flex-col justify-center rounded-lg border bg-card/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
