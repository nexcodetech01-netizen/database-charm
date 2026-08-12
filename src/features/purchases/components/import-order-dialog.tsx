import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, FileCode2, ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { parseOrderDocument } from "../lib/parse-order-document.functions";
import { parseNfeXml } from "../lib/parse-nfe-xml";
import { generateNextSku } from "@/features/products/lib/sku-generator";
import type { PurchaseItemDraft } from "../types";
import { PurchaseImportReviewDialog } from "./purchase-import-review-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onImport: (items: PurchaseItemDraft[]) => void;
}

type Tab = "pdf" | "xml" | "image";

export function ImportOrderDialog({ open, onOpenChange, companyId, onImport }: Props) {
  const [tab, setTab] = useState<Tab>("pdf");
  const [loading, setLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [itemsToReview, setItemsToReview] = useState<PurchaseItemDraft[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const parseDoc = useServerFn(parseOrderDocument);

  function pickFile() {
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    setLoading(true);
    try {
      let extracted: {
        description: string;
        color: string;
        quantity: number;
        unit_price: number;
      }[] = [];

      if (tab === "xml") {
        const text = await file.text();
        extracted = parseNfeXml(text);
      } else {
        const dataUrl = await fileToDataUrl(file);
        const res = await withTimeout(
          parseDoc({
            data: { kind: tab === "image" ? "image" : "pdf", dataUrl, filename: file.name },
          }),
          CLIENT_TIMEOUT_MS,
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        extracted = res.items;
      }

      if (extracted.length === 0) {
        toast.warning("Nenhum item identificado no arquivo.");
        return;
      }

      const drafts: PurchaseItemDraft[] = [];
      for (const it of extracted) {
        const description = it.color
          ? `${it.description} — ${it.color}`
          : it.description;
        let sku: string | null = null;
        try {
          sku = await generateNextSku(companyId, description);
        } catch {
          sku = null;
        }
        drafts.push({
          product_id: null,
          description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: 0,
          sku,
        });
      }

      setItemsToReview(drafts);
      setReviewOpen(true);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof TimeoutError
          ? "A leitura do arquivo demorou demais. Tente novamente com um arquivo menor."
          : err instanceof Error && err.message
            ? err.message
            : "Falha ao processar arquivo. Tente novamente.",
      );
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const accept =
    tab === "pdf" ? "application/pdf" : tab === "xml" ? ".xml,text/xml,application/xml" : "image/*";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar pedido</DialogTitle>
            <DialogDescription>
              Envie o arquivo do fornecedor — a IA extrairá os itens e tratará kits automaticamente.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pdf" disabled={loading}>
                <FileText className="mr-1.5 h-4 w-4" /> PDF
              </TabsTrigger>
              <TabsTrigger value="xml" disabled={loading}>
                <FileCode2 className="mr-1.5 h-4 w-4" /> NF-e / XML
              </TabsTrigger>
              <TabsTrigger value="image" disabled={loading}>
                <ImageIcon className="mr-1.5 h-4 w-4" /> Foto
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-4 text-sm text-muted-foreground">
              Pedido em PDF — a IA extrai itens, quantidades e fraciona kits (ex: "Kit 20 un").
            </TabsContent>
            <TabsContent value="xml" className="mt-4 text-sm text-muted-foreground">
              Nota Fiscal (NF-e) em XML — leitura local rápida de itens e impostos.
            </TabsContent>
            <TabsContent value="image" className="mt-4 text-sm text-muted-foreground">
              Foto ou print do pedido — a IA identifica itens e preços visíveis.
            </TabsContent>
          </Tabs>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={pickFile} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Processando…
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Selecionar arquivo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PurchaseImportReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        items={itemsToReview}
        onConfirm={(confirmedItems) => {
          onImport(confirmedItems);
          setReviewOpen(false);
          toast.success(`${confirmedItems.length} itens importados com sucesso.`);
        }}
      />
    </>
  );
}

/** Limite máximo de espera pela leitura por IA (servidor responde antes, em 45s). */
const CLIENT_TIMEOUT_MS = 60_000;

class TimeoutError extends Error {
  constructor() {
    super("Tempo de leitura esgotado.");
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}


function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
