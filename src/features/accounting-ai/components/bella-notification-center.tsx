import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Boxes,
  CheckCircle2,
  Info,
  Package,
  Percent,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  categoryLabel,
  notificationBadge,
  notificationIcon,
  type BellaNotification,
  type NotificationIconName,
  type NotificationSeverity,
} from "../proactive";

export interface BellaNotificationCenterProps {
  notifications: BellaNotification[];
  loading?: boolean;
  limit?: number;
  title?: string;
  description?: string;
  onDismiss?: (id: string) => void;
  className?: string;
}

const ICONS: Record<NotificationIconName, typeof Info> = {
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  wallet: Wallet,
  boxes: Boxes,
  users: Users,
  package: Package,
  receipt: Receipt,
  percent: Percent,
  alert: AlertTriangle,
  check: CheckCircle2,
  info: Info,
};

const TONES: Record<NotificationSeverity, string> = {
  critical: "bg-destructive/10 text-destructive",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  info: "bg-primary/10 text-primary",
};

/**
 * "Atenção da Bella" — central de notificações proativas.
 * Apresentação pura: não calcula nada e não executa nenhuma ação.
 */
export function BellaNotificationCenter({
  notifications,
  loading = false,
  limit = 5,
  title = "Atenção da Bella",
  description = "O que a Bella percebeu sozinha nos dados do período — apenas recomendações.",
  onDismiss,
  className,
}: BellaNotificationCenterProps) {
  const list = notifications.slice(0, limit);
  const criticalCount = notifications.filter((n) => n.severity === "critical").length;

  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BellRing className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {criticalCount > 0 ? (
            <Badge variant="destructive" className="rounded-lg font-normal">
              {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
            </Badge>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada exigindo sua atenção agora.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((notification) => {
              const Icon = ICONS[notificationIcon(notification)];
              return (
                <li
                  key={notification.id}
                  className="flex gap-3 rounded-xl border border-border/60 p-3"
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                      TONES[notification.severity],
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-tight">{notification.title}</p>
                      <Badge variant="outline" className="rounded-lg font-normal">
                        {categoryLabel(notification.category)}
                      </Badge>
                      <Badge variant="secondary" className="rounded-lg font-normal">
                        {notificationBadge(notification)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-foreground">
                        {notification.action.label}:
                      </span>
                      <span className="truncate">{notification.recommendation}</span>
                    </p>
                  </div>
                  {notification.dismissible && onDismiss ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground"
                      aria-label={`Dispensar ${notification.title}`}
                      onClick={() => onDismiss(notification.id)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
