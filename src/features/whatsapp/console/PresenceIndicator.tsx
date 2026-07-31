import { cn } from "@/lib/utils";

/** Ponto de presença — verde se a conversa recebeu mensagem nos últimos 5 min. */
export function PresenceIndicator({
  lastAt,
  className,
}: {
  lastAt: string | null;
  className?: string;
}) {
  const isLive = lastAt
    ? Date.now() - new Date(lastAt).getTime() < 5 * 60 * 1000
    : false;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30",
        className,
      )}
      aria-hidden
    />
  );
}
