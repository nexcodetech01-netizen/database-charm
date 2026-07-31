import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTEXT_TYPE_LABELS, type ContextType } from "../types";
import { Database } from "lucide-react";

const CONTEXT_ORDER: ContextType[] = [
  "products",
  "purchases",
  "inventory",
  "customers",
  "crm",
  "sales",
  "finance",
  "agenda",
  "marketing",
  "reports",
];

export function BellaContextSources() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-primary" /> Fontes de contexto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {CONTEXT_ORDER.map((type) => (
            <div
              key={type}
              className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs"
            >
              <div className="font-medium text-foreground">{CONTEXT_TYPE_LABELS[type]}</div>
              <div className="text-[10px] text-muted-foreground">preparado</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
