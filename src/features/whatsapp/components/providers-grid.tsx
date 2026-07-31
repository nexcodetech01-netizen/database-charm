import { Plug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WHATSAPP_PROVIDERS } from "../data";

export function ProvidersGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {WHATSAPP_PROVIDERS.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                <Plug className="h-4 w-4" />
              </div>
              <Badge
                variant="secondary"
                className="h-4 bg-muted px-1.5 text-[9px] uppercase text-muted-foreground"
              >
                Não conectado
              </Badge>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {p.description}
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-7 w-full text-xs" disabled>
              Configurar
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
