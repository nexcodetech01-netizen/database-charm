/**
 * ImportCsvDialog — UI da importação CSV (Sprint 002).
 * O parse acontece no cliente (`parseProductsCsv`) e cada linha é
 * criada via `ProductService.create` respeitando RLS.
 */
import { useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import {
  parseProductsCsv,
  ProductService,
  type ParsedProductRow,
  type CsvIssue,
} from "@/features/products/v2";

interface ImportCsvDialogProps {
  companyId: string;
  onImported?: () => void;
}

export function ImportCsvDialog({ companyId, onImported }: ImportCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedProductRow[]>([]);
  const [issues, setIssues] = useState<CsvIssue[]>([]);
  const [importing, setImporting] = useState(false);

  function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo maior que 5MB. Divida em partes menores.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseProductsCsv(text);
      setRows(parsed.rows);
      setIssues(parsed.issues);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!rows.length) return;
    setImporting(true);
    const { data: userData } = await supabase.auth.getUser();
    const ctx = {
      ...buildExecutionContext({
        companyId,
        userId: userData.user?.id ?? null,
        permissions: new Set<string>(["*"]),
        isOwner: true,
        channel: "web" as const,
      }),
      supabase,
    };
    const svc = new ProductService(ctx);
    let ok = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await svc.create({
          name: row.name,
          price: row.price,
          cost: row.cost ?? 0,
          sku: row.sku ?? null,
          unit: row.unit ?? "un",
          barcode: row.barcode ?? null,
          minStock: row.minStock ?? 0,
          description: row.description ?? null,
        });
        ok++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    toast.success(`${ok} produto(s) importado(s).${failed ? ` ${failed} falharam.` : ""}`);
    setOpen(false);
    setRows([]);
    setIssues([]);
    onImported?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar produtos (CSV)</DialogTitle>
          <DialogDescription>
            Colunas mínimas: <code>name</code>, <code>price</code>. Opcionais:{" "}
            <code>cost</code>, <code>sku</code>, <code>unit</code>, <code>barcode</code>,{" "}
            <code>minStock</code>, <code>description</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="csv-file">Arquivo CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {(rows.length > 0 || issues.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>{rows.length}</strong> linha(s) válida(s) prontas para importar.
                </AlertDescription>
              </Alert>
              {issues.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{issues.length}</strong> linha(s) com problema — serão ignoradas.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <ScrollArea className="h-40 rounded border p-2 text-xs">
              {rows.slice(0, 20).map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  {r.name} — R$ {r.price.toFixed(2)}
                  {r.sku ? ` · ${r.sku}` : ""}
                </div>
              ))}
              {rows.length > 20 && (
                <div className="pt-1 text-muted-foreground">…e mais {rows.length - 20}.</div>
              )}
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!rows.length || importing}>
            {importing ? "Importando…" : `Importar ${rows.length} produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
