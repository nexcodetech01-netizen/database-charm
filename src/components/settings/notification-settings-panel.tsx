import { Bell, Volume2, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNotificationSettings, DEFAULT_SETTINGS } from "@/hooks/use-notification-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<string, { title: string; description: string }> = {
  "catalog.order.received": {
    title: "Pedidos do Catálogo",
    description: "Novos pedidos recebidos via WhatsApp/Catálogo",
  },
  "sale.created": {
    title: "Vendas Criadas",
    description: "Notificações para novas vendas no sistema",
  },
  "finance.invoice.overdue": {
    title: "Financeiro em Atraso",
    description: "Alertas para contas e faturas vencidas",
  },
  "inventory.min_stock_reached": {
    title: "Estoque Mínimo",
    description: "Alertas quando produtos atingem o estoque crítico",
  },
};

export function NotificationSettingsPanel() {
  const { settings, isLoading, toggleSetting } = useNotificationSettings();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const eventTypes = Object.keys(DEFAULT_SETTINGS);

  return (
    <div className="space-y-4 w-full">
      <div className="grid gap-2.5">
        {eventTypes.map((type) => {
          const config = settings[type] || { sound: false, browser: false };
          const label = EVENT_LABELS[type] || { title: type, description: "" };
          const isCatalog = type === "catalog.order.received";

          return (
            <div
              key={type}
              className={cn(
                "group relative flex flex-col rounded-xl border bg-card/40 transition-all duration-200 hover:bg-card/60 overflow-hidden",
                isCatalog && "border-primary/30 bg-primary/5 shadow-[0_0_15px_-3px_rgba(59,130,246,0.1)]"
              )}
            >
              {isCatalog && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              )}
              
              <div className="p-3 pb-1.5 flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                  <h4 className={cn(
                    "text-xs font-bold tracking-tight uppercase opacity-90",
                    isCatalog ? "text-primary" : "text-foreground"
                  )}>
                    {label.title}
                  </h4>
                  <p className="text-[10px] leading-tight text-muted-foreground/70 line-clamp-1">
                    {label.description}
                  </p>
                </div>
              </div>

              <div className="px-3 pb-2.5 space-y-0.5">
                <div className="h-[1px] bg-border/30 w-full mb-1.5" />
                
                <div className="flex items-center justify-between group/row py-0.5">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3 w-3 text-muted-foreground/70" />
                    <Label 
                      htmlFor={`${type}-sound`} 
                      className="text-[11px] font-medium cursor-pointer text-foreground/80"
                    >
                      Som de Alerta
                    </Label>
                  </div>
                  <Switch
                    id={`${type}-sound`}
                    checked={config.sound}
                    onCheckedChange={() => toggleSetting(type, "sound")}
                    className="scale-[0.8] origin-right pointer-events-auto"
                  />
                </div>

                <div className="flex items-center justify-between group/row py-0.5">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-3 w-3 text-muted-foreground/70" />
                    <Label 
                      htmlFor={`${type}-browser`} 
                      className="text-[11px] font-medium cursor-pointer text-foreground/80"
                    >
                      Notificação Push
                    </Label>
                  </div>
                  <Switch
                    id={`${type}-browser`}
                    checked={config.browser}
                    onCheckedChange={() => toggleSetting(type, "browser")}
                    className="scale-[0.75] origin-right"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}