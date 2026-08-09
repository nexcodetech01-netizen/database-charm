import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer as PrinterIcon, Tag, Receipt } from "lucide-react";

export function PrintConfigSummary() {
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
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Modelo:</span>
            <p className="text-sm font-medium">Zebra / Label / Argox / Elgin...</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Destino:</span>
            <p className="text-sm font-medium">Nome da impressora Windows</p>
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
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Modelo:</span>
            <p className="text-sm font-medium">KP10-25</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Destino:</span>
            <p className="text-sm font-medium">Nome da impressora Windows</p>
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
