import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Printer, Package, Loader2, Table as TableIcon } from "lucide-react";
import { KpiSection, KpiCard } from "@/components/layout";
import { formatNumber } from "@/lib/format";

import type jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCompanyBranding } from "@/features/settings/hooks/use-company-branding";
import { toast } from "sonner";

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

/* ---------- Types ---------- */

interface PricingProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  status: string | null;
  brand: string | null;
  stock: number | null;
  category_id: string | null;
  supplier_id: string | null;
  cover_image_path: string | null;
  cost: number | null;
  freight: number | null;
  packaging: number | null;
  insurance: number | null;
  other_costs: number | null;
}

type SortKey = "name" | "sku" | "price" | "margin" | "profit";
type StockFilter = "all" | "in_stock";

/* ---------- Helpers ---------- */

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

async function cropCoverSquareAsync(loaded: LoadedImage): Promise<LoadedImage> {
  const srcAspect = loaded.w / loaded.h;
  let sw = loaded.w;
  let sh = loaded.h;
  let sx = 0;
  let sy = 0;
  if (srcAspect > 1) {
    sw = loaded.h;
    sx = (loaded.w - sw) / 2;
  } else if (srcAspect < 1) {
    sh = loaded.w;
    sy = (loaded.h - sh) / 2;
  }
  const OUT = 160; // small — table thumbnail
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = loaded.data;
  });
  if (!img) return loaded;
  const canvas = document.createElement("canvas");
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return loaded;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, OUT, OUT);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT, OUT);
  const data = canvas.toDataURL("image/jpeg", 0.85);
  return { data, w: OUT, h: OUT };
}

function truncate(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  const ell = "…";
  let s = text;
  while (s.length > 0 && doc.getTextWidth(s + ell) > maxW) s = s.slice(0, -1);
  return s + ell;
}

/**
 * Renderiza o SKU sem NUNCA truncar. Estratégia:
 * 1. Tenta caber em uma linha reduzindo a fonte de 8pt até 4pt.
 * 2. Se ainda não couber, quebra em múltiplas linhas via splitTextToSize.
 * O valor exibido é sempre o SKU integral gravado em products.sku —
 * o caractere "…" nunca é inserido nesta coluna.
 */
function renderSkuCell(
  doc: jsPDF,
  text: string,
  cx: number,
  y: number,
  w: number,
  rowH: number,
  pad: number,
): void {
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  const maxW = w - pad * 2;
  const tx = cx + pad;

  let size = 8;
  doc.setFontSize(size);
  while (size > 4 && doc.getTextWidth(text) > maxW) {
    size -= 0.25;
    doc.setFontSize(size);
  }

  if (doc.getTextWidth(text) <= maxW) {
    doc.text(text, tx, y + rowH / 2 + 1.2, { align: "left" });
  } else {
    // Fallback extremo: quebra em quantas linhas forem necessárias.
    // Preserva o valor integral do SKU sem qualquer truncamento.
    const lines = doc.splitTextToSize(text, maxW) as string[];
    const lineH = size * 0.42 + 0.2;
    const totalH = lines.length * lineH;
    let ly = y + Math.max(0, (rowH - totalH) / 2) + size * 0.35 + 0.4;
    for (const line of lines) {
      doc.text(line, tx, ly, { align: "left" });
      ly += lineH;
    }
  }

  doc.setFontSize(8);
}


function computeMetrics(p: PricingProduct) {
  const totalCost =
    Number(p.cost ?? 0) +
    Number(p.freight ?? 0) +
    Number(p.packaging ?? 0) +
    Number(p.insurance ?? 0) +
    Number(p.other_costs ?? 0);
  const price = Number(p.price ?? 0);
  const profit = price - totalCost;
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  return { totalCost, price, profit, marginPct };
}

/* ---------- Component ---------- */

export function ProductCatalogWorkspace({
  companyId,
  onBack,
}: {
  companyId: string;
  onBack: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string>("all");
  const [supplierId, setSupplierId] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [status, setStatus] = useState<string>("active");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [showPhoto, setShowPhoto] = useState<boolean>(true);
  const [generating, setGenerating] = useState(false);

  const brandingQuery = useCompanyBranding(companyId);
  const branding = brandingQuery.data ?? null;

  const filtersQuery = useQuery({
    queryKey: ["pricing-filters", companyId],
    queryFn: async () => {
      const [cats, sups, brands] = await Promise.all([
        supabase.from("product_categories").select("id, name").eq("company_id", companyId).order("name"),
        supabase.from("product_suppliers").select("id, name").eq("company_id", companyId).order("name"),
        supabase.from("products").select("brand").eq("company_id", companyId).not("brand", "is", null),
      ]);
      const uniqueBrands = Array.from(
        new Set((brands.data ?? []).map((b) => (b.brand ?? "").trim()).filter((b) => b.length > 0)),
      ).sort((a, b) => a.localeCompare(b));
      return {
        categories: cats.data ?? [],
        suppliers: sups.data ?? [],
        brands: uniqueBrands,
      };
    },
    enabled: Boolean(companyId),
    staleTime: 5 * 60_000,
  });

  const productsQuery = useQuery({
    queryKey: [
      "pricing-products",
      companyId,
      categoryId,
      supplierId,
      brand,
      status,
      stockFilter,
      minPrice,
      maxPrice,
      sortBy,
    ],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select(
          "id,name,sku,price,status,brand,stock,category_id,supplier_id,cover_image_path,cost,freight,packaging,insurance,other_costs",
        )
        .eq("company_id", companyId);

      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      if (supplierId !== "all") q = q.eq("supplier_id", supplierId);
      if (brand !== "all") q = q.eq("brand", brand);
      if (status !== "all") q = q.eq("status", status);
      if (stockFilter === "in_stock") q = q.gt("stock", 0);
      const min = Number(minPrice);
      const max = Number(maxPrice);
      if (minPrice.trim() && Number.isFinite(min)) q = q.gte("price", min);
      if (maxPrice.trim() && Number.isFinite(max)) q = q.lte("price", max);

      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as PricingProduct[];
    },
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });

  const products = useMemo(() => {
    const list = [...(productsQuery.data ?? [])];
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "sku") return (a.sku ?? "").localeCompare(b.sku ?? "");
      if (sortBy === "price") return Number(a.price ?? 0) - Number(b.price ?? 0);
      const ma = computeMetrics(a);
      const mb = computeMetrics(b);
      if (sortBy === "margin") return mb.marginPct - ma.marginPct;
      return mb.profit - ma.profit;
    });
    return list;
  }, [productsQuery.data, sortBy]);

  const summaryTotals = useMemo(() => {
    return products.reduce(
      (acc, p) => {
        const m = computeMetrics(p);
        const stock = Number(p.stock ?? 0);
        acc.stock += stock;
        acc.cost += m.totalCost * stock;
        acc.revenue += m.price * stock;
        acc.profit += m.profit * stock;
        return acc;
      },
      { stock: 0, cost: 0, revenue: 0, profit: 0 },
    );
  }, [products]);

  async function generatePdf(action: "download" | "print") {
    if (products.length === 0 || generating) return;
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const { default: JsPDF } = await import("jspdf");
      const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 8;
      const headerH = 16;
      const footerH = 6;

      // Preload images (small)
      const imageMap = new Map<string, LoadedImage | null>();
      if (showPhoto) {
        const paths = Array.from(
          new Set(products.map((p) => p.cover_image_path).filter((v): v is string => !!v)),
        );
        const signed = await signPathsBatch(paths);
        const CONCURRENCY = 6;
        let i = 0;
        async function worker() {
          while (i < paths.length) {
            const idx = i++;
            const path = paths[idx];
            const url = signed.get(path) ?? null;
            const raw = url ? await imageToDataUrl(url) : null;
            let cropped: LoadedImage | null = null;
            try {
              cropped = raw ? await cropCoverSquareAsync(raw) : null;
            } catch {
              cropped = raw;
            }
            imageMap.set(path, cropped);
          }
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      }

      let logoImg: LoadedImage | null = null;
      if (branding?.logoUrl) {
        try {
          logoImg = await imageToDataUrl(branding.logoUrl);
        } catch {
          /* noop */
        }
      }
      const companyName = (branding?.company?.trade_name || branding?.company?.name || "").trim();

      // Column layout (mm) — landscape A4 = 297 x 210
      const availableW = pageW - margin * 2;
      const cols = showPhoto
        ? [
            { key: "photo", label: "", w: 12, align: "left" as const },
            { key: "name", label: "Produto", w: 0, align: "left" as const }, // flex
            { key: "sku", label: "SKU", w: 50, align: "left" as const },
            { key: "stock", label: "Estoque", w: 18, align: "right" as const },
            { key: "cost", label: "Custo", w: 24, align: "right" as const },
            { key: "margin", label: "Margem", w: 20, align: "right" as const },
            { key: "profit", label: "Lucro Estimado (R$)", w: 36, align: "right" as const },
            { key: "price", label: "Preço", w: 26, align: "right" as const },
          ]
        : [
            { key: "name", label: "Produto", w: 0, align: "left" as const },
            { key: "sku", label: "SKU", w: 52, align: "left" as const },

            { key: "stock", label: "Estoque", w: 20, align: "right" as const },
            { key: "cost", label: "Custo", w: 26, align: "right" as const },
            { key: "margin", label: "Margem", w: 22, align: "right" as const },
            { key: "profit", label: "Lucro Estimado (R$)", w: 38, align: "right" as const },
            { key: "price", label: "Preço", w: 28, align: "right" as const },
          ];
      const fixedW = cols.reduce((sum, c) => sum + c.w, 0);
      const flexCol = cols.find((c) => c.w === 0);
      if (flexCol) flexCol.w = Math.max(40, availableW - fixedW);

      const rowH = showPhoto ? 12 : 7;
      const cellPad = 2;
      const startYFirst = margin + headerH;
      const usableH = pageH - margin - footerH - startYFirst;
      const rowsPerPage = Math.max(1, Math.floor(usableH / rowH));

      // Financial summary (once, on last page below the table) — uses the same
      // totals shown in the on-screen KPI cards to keep values in lockstep.
      const summaryH = 40; // mm reserved for the summary block (incl. breathing room)
      const totals = summaryTotals;

      const baseTotalPages = Math.max(1, Math.ceil(products.length / rowsPerPage));
      const lastPageRows = products.length - (baseTotalPages - 1) * rowsPerPage;
      const lastPageUsedH = lastPageRows * rowH;
      // Require a comfortable gap so the summary is never squeezed against the table.
      const summaryOnNewPage = usableH - lastPageUsedH < summaryH + 8;
      const totalPages = summaryOnNewPage ? baseTotalPages + 1 : baseTotalPages;

      function drawHeader(page: number) {
        // company header
        const logoSize = 10;
        let textX = margin;
        if (logoImg) {
          const aspect = logoImg.w / logoImg.h;
          const lw = Math.min(logoSize * aspect, logoSize * 1.6);
          try {
            doc.addImage(logoImg.data, detectImageFormat(logoImg.data), margin, margin, lw, logoSize, undefined, "FAST");
            textX = margin + lw + 3;
          } catch {
            /* noop */
          }
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(companyName ? companyName.toUpperCase() : "Relatório de Precificação", textX, margin + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Tabela de Precificação (Interno)", textX, margin + 9.5);

        const dateStr = new Date().toLocaleDateString("pt-BR");
        doc.setFontSize(8);
        doc.text(dateStr, pageW - margin, margin + 5, { align: "right" });
        doc.text(`Página ${page + 1} de ${totalPages}`, pageW - margin, margin + 9.5, { align: "right" });

        // table column header row
        const y = margin + headerH - 4;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, y + 1.5, pageW - margin, y + 1.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        let cx = margin;
        for (const c of cols) {
          const tx = c.align === "right" ? cx + c.w - cellPad : cx + cellPad;
          doc.text(c.label, tx, y, { align: c.align });
          cx += c.w;
        }
        doc.setLineWidth(0.3);
        doc.setDrawColor(203, 213, 225);
        doc.line(margin, y + 2, pageW - margin, y + 2);
      }

      function drawFooter() {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Gerado automaticamente pelo NexOS", margin, pageH - 2);
      }

      function drawSummary(startY: number) {
        const boxX = margin;
        const boxY = startY;
        const boxW = availableW;
        const boxH = summaryH;
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.setLineWidth(0.3);
        doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text("Resumo financeiro", boxX + 4, boxY + 6);

        const rows: Array<{ label: string; value: string; accent?: boolean }> = [
          { label: "Quantidade de produtos", value: String(products.length) },
          { label: "Quantidade total em estoque", value: String(totals.stock) },
          { label: "Custo total do estoque", value: formatCurrency(totals.cost) },
          { label: "Valor potencial de venda", value: formatCurrency(totals.revenue) },
          { label: "Lucro estimado total", value: formatCurrency(totals.profit), accent: true },
        ];
        const lineH = 5;
        const labelX = boxX + 4;
        const valueX = boxX + boxW - 4;
        let ly = boxY + 12;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        for (const r of rows) {
          doc.setTextColor(71, 85, 105);
          doc.text(r.label, labelX, ly);
          if (r.accent) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(22, 101, 52);
          } else {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
          }
          doc.text(r.value, valueX, ly, { align: "right" });
          doc.setFont("helvetica", "normal");
          ly += lineH;
        }
      }

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage();
        drawHeader(page);
        drawFooter();

        const isSummaryOnlyPage = summaryOnNewPage && page === totalPages - 1;
        const items = isSummaryOnlyPage
          ? []
          : products.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
        let y = startYFirst;
        for (let idx = 0; idx < items.length; idx++) {
          const p = items[idx];
          const m = computeMetrics(p);

          // zebra
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y, availableW, rowH, "F");
          }

          let cx = margin;
          for (const c of cols) {
            const midY = y + rowH / 2 + 1.2;

            if (c.key === "photo") {
              const img = p.cover_image_path ? imageMap.get(p.cover_image_path) : null;
              const size = rowH - 2;
              const ix = cx + (c.w - size) / 2;
              const iy = y + 1;
              doc.setFillColor(245, 245, 245);
              doc.rect(ix, iy, size, size, "F");
              if (img) {
                try {
                  doc.addImage(img.data, detectImageFormat(img.data), ix, iy, size, size, undefined, "FAST");
                } catch {
                  /* noop */
                }
              }
            } else if (c.key === "sku") {
              // SKU nunca é truncado. Ver renderSkuCell() para a estratégia de shrink+wrap.
              renderSkuCell(doc, p.sku || "—", cx, y, c.w, rowH, cellPad);
            } else {
              doc.setFont("helvetica", c.key === "price" ? "bold" : "normal");
              doc.setFontSize(8);
              if (c.key === "price") doc.setTextColor(37, 99, 235);
              else if (c.key === "profit") doc.setTextColor(m.profit >= 0 ? 22 : 190, m.profit >= 0 ? 101 : 60, m.profit >= 0 ? 52 : 60);
              else if (c.key === "margin") doc.setTextColor(m.marginPct >= 0 ? 22 : 190, m.marginPct >= 0 ? 101 : 60, m.marginPct >= 0 ? 52 : 60);
              else doc.setTextColor(30, 41, 59);

              let value = "";
              switch (c.key) {
                case "name":
                  value = truncate(doc, p.name || "—", c.w - cellPad * 2);
                  break;
                case "stock":
                  value = String(p.stock ?? 0);
                  break;
                case "cost":
                  value = formatCurrency(m.totalCost);
                  break;
                case "margin":
                  value = `${m.marginPct.toFixed(1)}%`;
                  break;
                case "profit":
                  value = formatCurrency(m.profit);
                  break;
                case "price":
                  value = p.price != null ? formatCurrency(Number(p.price)) : "—";
                  break;
              }
              // Guard every column against overflow into the next one.
              value = truncate(doc, value, c.w - cellPad * 2);
              const tx = c.align === "right" ? cx + c.w - cellPad : cx + cellPad;
              doc.text(value, tx, midY, { align: c.align });
            }
            cx += c.w;
          }

          // row separator line
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.1);
          doc.line(margin, y + rowH, pageW - margin, y + rowH);

          y += rowH;
        }

        // Draw summary at the end of the last page
        if (page === totalPages - 1) {
          const summaryY = isSummaryOnlyPage ? startYFirst : y + 4;
          drawSummary(summaryY);
        }
      }

      const filename = `precificacao-${new Date().toISOString().slice(0, 10)}.pdf`;
      if (action === "download") {
        const blob = doc.output("blob") as Blob;
        await savePdfBlob(blob, filename);
      } else {
        const blob = doc.output("blob") as Blob;
        const blobUrl = URL.createObjectURL(blob);
        const w = window.open(blobUrl, "_blank");
        if (w) {
          w.addEventListener("load", () => {
            try { w.print(); } catch { /* noop */ }
          });
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      }
    } catch (err) {
      console.error("[Precificação PDF] Falha:", err);
      const message = err instanceof Error ? err.message : "Erro desconhecido ao gerar o PDF.";
      toast.error("Não foi possível gerar o PDF", { description: message });
    } finally {
      setGenerating(false);
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
              <TableIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Tabela de Precificação (Interno)
              </h2>
              <p className="text-sm text-muted-foreground">
                Conferência gerencial de custo, margem, lucro e preço.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => generatePdf("print")}
            disabled={products.length === 0 || generating}
          >
            {generating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-2 h-3.5 w-3.5" />}
            Imprimir
          </Button>
          <Button
            size="sm"
            className="h-8"
            onClick={() => generatePdf("download")}
            disabled={products.length === 0 || generating}
            aria-busy={generating}
          >
            {generating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-2 h-3.5 w-3.5" />}
            {generating ? "Gerando PDF..." : "Gerar PDF"}
          </Button>
        </div>
      </div>

      {generating ? (
        <div className="flex items-center gap-2 rounded-lg border bg-card/60 p-3 text-sm" role="status" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="font-medium text-foreground">Gerando tabela...</span>
        </div>
      ) : null}

      <KpiSection columns={5}>
        <KpiCard label="Produtos" value={formatNumber(products.length)} />
        <KpiCard label="Estoque total" value={formatNumber(summaryTotals.stock)} />
        <KpiCard label="Custo total do estoque" value={formatCurrency(summaryTotals.cost)} />
        <KpiCard label="Valor potencial de venda" value={formatCurrency(summaryTotals.revenue)} />
        <KpiCard label="Lucro estimado total" value={formatCurrency(summaryTotals.profit)} />
      </KpiSection>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FilterField label="Categoria">
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(filtersQuery.data?.categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Fornecedor">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(filtersQuery.data?.suppliers ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Marca">
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(filtersQuery.data?.brands ?? []).map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Estoque">
                <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="in_stock">Com estoque</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Faixa de preço">
                <div className="flex items-center gap-2">
                  <Input type="number" inputMode="decimal" placeholder="Mín." value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="h-9" />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="number" inputMode="decimal" placeholder="Máx." value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="h-9" />
                </div>
              </FilterField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Exibição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
                <Checkbox checked={showPhoto} onCheckedChange={(v) => setShowPhoto(Boolean(v))} />
                <span>Exibir foto</span>
              </label>
              <FilterField label="Ordenar por">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nome</SelectItem>
                    <SelectItem value="sku">SKU</SelectItem>
                    <SelectItem value="price">Preço</SelectItem>
                    <SelectItem value="margin">Margem (%)</SelectItem>
                    <SelectItem value="profit">Lucro (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TableIcon className="h-3.5 w-3.5" /> Precificação
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {productsQuery.isLoading ? "Carregando..." : `${products.length} produto(s)`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {productsQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="grid place-items-center py-16 text-center text-sm text-muted-foreground">
                <Package className="mb-2 h-8 w-8 text-muted-foreground/60" />
                Nenhum produto encontrado com os filtros atuais.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      {showPhoto ? <th className="w-[60px] px-3 py-2 text-left font-medium"></th> : null}
                      <th className="px-3 py-2 text-left font-medium">Produto</th>
                      <th className="px-3 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-right font-medium">Estoque</th>
                      <th className="px-3 py-2 text-right font-medium">Custo</th>
                      <th className="px-3 py-2 text-right font-medium">Margem</th>
                      <th className="px-3 py-2 text-right font-medium">Lucro Estimado (R$)</th>
                      <th className="px-3 py-2 text-right font-medium">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <PricingRow key={p.id} product={p} showPhoto={showPhoto} zebra={i % 2 === 1} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PricingRow({
  product,
  showPhoto,
  zebra,
}: {
  product: PricingProduct;
  showPhoto: boolean;
  zebra: boolean;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!showPhoto || !product.cover_image_path) {
      setImgUrl(null);
      return;
    }
    supabase.storage
      .from("product-images")
      .createSignedUrl(product.cover_image_path, SIGNED_URL_TTL)
      .then(({ data }) => {
        if (!cancelled) setImgUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [product.cover_image_path, showPhoto]);

  const m = computeMetrics(product);

  return (
    <tr className={cn("border-t border-border/60", zebra && "bg-muted/20")}>
      {showPhoto ? (
        <td className="px-3 py-1.5">
          <div className="h-[50px] w-[50px] overflow-hidden rounded-sm bg-muted/50">
            {imgUrl ? (
              <img src={imgUrl} alt={product.name} className="h-full w-full object-cover object-center" loading="lazy" />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground/60">
                <Package className="h-4 w-4" />
              </div>
            )}
          </div>
        </td>
      ) : null}
      <td className="px-3 py-1.5 font-medium text-foreground">
        <span className="line-clamp-1">{product.name}</span>
      </td>
      <td className="px-3 py-1.5 text-muted-foreground">{product.sku ?? "—"}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{product.stock ?? 0}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(m.totalCost)}</td>
      <td
        className={cn(
          "px-3 py-1.5 text-right tabular-nums font-medium",
          m.marginPct >= 0 ? "text-emerald-600" : "text-red-600",
        )}
      >
        {m.marginPct.toFixed(1)}%
      </td>
      <td
        className={cn(
          "px-3 py-1.5 text-right tabular-nums font-medium",
          m.profit >= 0 ? "text-emerald-600" : "text-red-600",
        )}
      >
        {formatCurrency(m.profit)}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-primary">
        {product.price != null ? formatCurrency(Number(product.price)) : "—"}
      </td>
    </tr>
  );
}
