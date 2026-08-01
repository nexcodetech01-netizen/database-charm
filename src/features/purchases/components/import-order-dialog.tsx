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
        // Timeout do cliente: a UI nunca fica presa em "Processando…".
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

      // Gera nosso SKU interno para cada item (linha manual, product_id null).
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

      onImport(drafts);
      toast.success(
        `${drafts.length} ${drafts.length === 1 ? "item importado" : "itens importados"} para conferência.`,
      );
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Falha ao processar arquivo.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const accept =
    tab === "pdf" ? "application/pdf" : tab === "xml" ? ".xml,text/xml,application/xml" : "image/*";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar pedido</DialogTitle>
          <DialogDescription>
            Envie o arquivo do fornecedor — os itens serão extraídos e
            preenchidos na tabela para conferência.
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
            Pedido em PDF — a IA extrai itens, cor, quantidade e preço unitário.
            O SKU do fornecedor é ignorado; geramos o nosso automaticamente.
          </TabsContent>
          <TabsContent value="xml" className="mt-4 text-sm text-muted-foreground">
            Nota Fiscal (NF-e) em XML — leitura local, sem enviar para IA.
          </TabsContent>
          <TabsContent value="image" className="mt-4 text-sm text-muted-foreground">
            Foto ou print do pedido — a IA identifica itens visíveis na imagem.
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
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
