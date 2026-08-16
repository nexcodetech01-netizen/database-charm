import { Bell, Volume2, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotificationSettings, DEFAULT_SETTINGS } from "@/hooks/use-notification-settings";
import { Skeleton } from "@/components/ui/skeleton";

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
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const eventTypes = Object.keys(DEFAULT_SETTINGS);

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Configurações de Alertas
        </CardTitle>
        <CardDescription>
          Personalize como você deseja ser notificado para cada tipo de evento.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        {eventTypes.map((type) => {
          const config = settings[type] || { sound: false, browser: false };
          const label = EVENT_LABELS[type] || { title: type, description: "" };

          return (
            <div key={type} className="flex flex-col gap-3 p-4 rounded-lg border bg-card/50">
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-semibold">{label.title}</h4>
                <p className="text-xs text-muted-foreground">{label.description}</p>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={`${type}-sound`} className="text-xs cursor-pointer">Som de Alerta</Label>
                </div>
                <Switch
                  id={`${type}-sound`}
                  checked={config.sound}
                  onCheckedChange={() => toggleSetting(type, "sound")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={`${type}-browser`} className="text-xs cursor-pointer">Notificação Push</Label>
                </div>
                <Switch
                  id={`${type}-browser`}
                  checked={config.browser}
                  onCheckedChange={() => toggleSetting(type, "browser")}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
