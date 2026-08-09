import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer as PrinterIcon, Tag, Receipt, Play } from "lucide-react";
import { usePrintPreferences } from "../../hooks/use-print-preferences";
import { useQuery } from "@tanstack/react-query";
import { printerService } from "../../services/printer.service";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { printManager } from "../../services/print.service";

export function PrintConfigSummary({ companyId }: { companyId?: string }) {
  const { prefs, save } = usePrintPreferences(companyId);
  const { data: printers = [] } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printerService.listPrinters()
  });

  const labelPrinter = printers.find(p => p.id === prefs.labelPrinterId || p.name === prefs.labelPrinterId);
  const receiptPrinter = printers.find(p => p.id === prefs.receiptPrinterId || p.name === prefs.receiptPrinterId);

  const handleTest = async (type: 'LABEL' | 'RECEIPT') => {
    const isLabel = type === 'LABEL';
    const targetId = isLabel ? prefs.labelPrinterId : prefs.receiptPrinterId;
    
    if (!targetId) {
      toast.error(`Configure a impressora de ${isLabel ? 'etiquetas' : 'cupom'} antes de testar.`);
      return;
    }

    toast.info(`Iniciando teste de ${isLabel ? 'etiqueta' : 'cupom'}...`);
    
    const labelData = isLabel ? {
      id: `test_${Date.now()}`,
      zpl: "^XA^FO50,50^A0N,50,50^FDTESTE NEXOS^FS^FO50,120^A0N,30,30^FDIMPRESSORA ETIQUETAS OK^FS^XZ",
      title: "Teste de Etiqueta"
    } : {
      id: `test_${Date.now()}`,
      content: "<html><body><h1>TESTE NEXOS</h1><p>Impressora de Cupom OK</p></body></html>",
      title: "Teste de Cupom"
    };

    const result = await printManager.print(labelData as any, {
      strategy: isLabel ? 'RAW' : 'PDF',
      type: type,
      printerId: targetId
    });

    if (result.success) {
      toast.success("Teste enviado com sucesso!");
    } else {
      toast.error(`Falha no teste: ${result.message}`);
    }
  };
  return (
    <div className="space-y-4 font-sans text-sm">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <span>Configurações</span>
        <span className="text-muted-foreground/50">→</span>
        <span className="font-medium text-foreground">Impressoras</span>
      </div>

      <Separator className="my-4" />

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-blue-600" />
            Impressora de Etiquetas
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-auto h-7 px-2 text-[10px] font-bold gap-1"
              onClick={() => handleTest('LABEL')}
            >
              <Play className="h-3 w-3" /> 🧪 Testar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Modelo:</span>
            <p className="text-sm font-medium">Zebra / Label / Argox / Elgin...</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Destino:</span>
            <p className="text-sm font-medium">{labelPrinter?.name || prefs.labelPrinterId || "Não configurada"}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Modo:</span>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 py-0 h-5 px-2 flex items-center gap-1 font-medium">
              ✔ Labelary (PDF)
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6 opacity-50" />

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" />
            Impressora de Cupom
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-auto h-7 px-2 text-[10px] font-bold gap-1"
              onClick={() => handleTest('RECEIPT')}
            >
              <Play className="h-3 w-3" /> 🧪 Testar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Modelo:</span>
            <p className="text-sm font-medium">KP10-25</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Destino:</span>
            <p className="text-sm font-medium">{receiptPrinter?.name || prefs.receiptPrinterId || "Não configurada"}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Modo:</span>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 py-0 h-5 px-2 flex items-center gap-1 font-medium">
              ✔ ESC/POS
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
