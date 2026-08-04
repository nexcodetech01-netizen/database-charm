import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Edit2, Plus, Send } from "lucide-react";
import { TEMPLATE_CATEGORY_ICON } from "../icons";
import { TEMPLATE_CATEGORY_LABELS, WHATSAPP_TEMPLATES } from "../data";

export function TemplatesGrid() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Modelos Disponíveis</h2>
        <Button size="sm" variant="default" className="h-8 shadow-sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo Modelo
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {WHATSAPP_TEMPLATES.map((tpl) => {
        const Icon = TEMPLATE_CATEGORY_ICON[tpl.category];
        return (
          <Card key={tpl.id} className="group relative overflow-hidden transition-all hover:border-primary/40 hover:shadow-md">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{tpl.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {TEMPLATE_CATEGORY_LABELS[tpl.category]}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant="secondary"
                    className="h-4 border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[9px] font-bold uppercase text-emerald-600"
                  >
                    ATIVO
                  </Badge>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="relative line-clamp-3 overflow-hidden rounded-md border border-border/50 bg-muted/30 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {tpl.preview.split(/(\{\{[^}]+\}\})/).map((part, i) => 
                  part.startsWith('{{') ? (
                    <span key={i} className="font-bold text-primary">{part}</span>
                  ) : part
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );
}
