import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TEMPLATE_CATEGORY_ICON } from "../icons";
import { TEMPLATE_CATEGORY_LABELS, WHATSAPP_TEMPLATES } from "../data";

export function TemplatesGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {WHATSAPP_TEMPLATES.map((tpl) => {
        const Icon = TEMPLATE_CATEGORY_ICON[tpl.category];
        return (
          <Card key={tpl.id} className="overflow-hidden">
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
                <Badge
                  variant="secondary"
                  className="h-4 border-warning/20 bg-warning/10 px-1.5 text-[9px] uppercase text-warning"
                >
                  Rascunho
                </Badge>
              </div>
              <p className="line-clamp-3 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                {tpl.preview}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
