import { useState } from "react";
import { Download, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useExportFiscalXmlsBatch } from "../hooks/use-fiscal";
import { toast } from "sonner";

export function ExportXmlDialog() {
  const [open, setOpen] = useState(false);
  const [rangeType, setRangeType] = useState("current_month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(new Date());
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date());
  
  const exportMutation = useExportFiscalXmlsBatch();

  const handleExport = async () => {
    let from: string;
    let to: string;

    const now = new Date();
    if (rangeType === "current_month") {
      from = startOfMonth(now).toISOString();
      to = endOfMonth(now).toISOString();
    } else if (rangeType === "last_month") {
      const lastMonth = subMonths(now, 1);
      from = startOfMonth(lastMonth).toISOString();
      to = endOfMonth(lastMonth).toISOString();
    } else {
      if (!customFrom || !customTo) {
        toast.error("Selecione o período personalizado.");
        return;
      }
      from = customFrom.toISOString();
      to = customTo.toISOString();
    }

    try {
      const files = await exportMutation.mutateAsync({ from, to });
      
      const zip = new JSZip();
      files.forEach((file) => {
        // Convert base64 to arraybuffer
        const binaryString = atob(file.contentBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        zip.file(file.name, bytes);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const fileName = `XMLs_Fiscal_${format(new Date(from), "yyyy-MM")}_ate_${format(new Date(to), "yyyy-MM-dd")}.zip`;
      saveAs(blob, fileName);
      
      toast.success(`${files.length} XMLs exportados com sucesso.`);
      setOpen(false);
    } catch (err) {
      // Erro já tratado no hook/toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar XMLs (ZIP)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Exportar XMLs em Lote</DialogTitle>
          <DialogDescription>
            Selecione o período das notas emitidas que deseja baixar em um arquivo ZIP.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Período</label>
            <Select value={rangeType} onValueChange={setRangeType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Mês Atual</SelectItem>
                <SelectItem value="last_month">Mês Anterior</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rangeType === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">De</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFrom ? format(customFrom, "dd/MM/yyyy") : <span>Início</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={setCustomFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Até</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customTo ? format(customTo, "dd/MM/yyyy") : <span>Fim</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={setCustomTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exportMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              "Baixar ZIP"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
