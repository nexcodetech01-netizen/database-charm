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
  "whatsapp.message.received": {
    title: "Mensagens do WhatsApp",
    description: "Alertas para novas mensagens recebidas no chat",
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
    <div className="space-y-4 w-full pb-6">
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
              
              <div className="p-4 pb-2 flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <h4 className={cn(
                    "text-[10px] font-black tracking-widest uppercase",
                    isCatalog ? "text-primary" : "text-blue-400"
                  )}>
                    {label.title}
                  </h4>
                  <p className="text-[10px] font-medium leading-tight text-muted-foreground/60">
                    {label.description}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4 space-y-2">
                <div className="h-[1px] bg-border/20 w-full mb-2" />
                
                <div className="flex items-center justify-between group/row">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <Label 
                      htmlFor={`${type}-sound`} 
                      className="text-[11px] font-semibold cursor-pointer text-foreground/80"
                    >
                      Som de Alerta
                    </Label>
                  </div>
                  <Switch
                    id={`${type}-sound`}
                    checked={config.sound}
                    onCheckedChange={() => toggleSetting(type, "sound")}
                    className="scale-[0.85] origin-right pointer-events-auto"
                  />
                </div>

                <div className="flex items-center justify-between group/row">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <Label 
                      htmlFor={`${type}-browser`} 
                      className="text-[11px] font-semibold cursor-pointer text-foreground/80"
                    >
                      Notificação Push
                    </Label>
                  </div>
                  <Switch
                    id={`${type}-browser`}
                    checked={config.browser}
                    onCheckedChange={() => toggleSetting(type, "browser")}
                    className="scale-[0.85] origin-right pointer-events-auto"
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