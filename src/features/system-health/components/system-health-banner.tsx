import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { actionableCount } from "../lib/health";
import { useSystemHealth } from "../hooks/use-system-health";

/** Aviso no dashboard quando a conferência achou algo para corrigir. */
export function SystemHealthBanner({ companyId }: { companyId: string }) {
  const { data } = useSystemHealth(companyId);
  const n = data ? actionableCount(data) : 0;
  if (n === 0) return null;
  const critical = data?.some((i) => i.severity === "critical");
  return (
    <Link
      to="/saude-sistema"
      className={
        "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:bg-muted/50 " +
        (critical ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10")
      }
    >
      <AlertTriangle className={critical ? "h-4 w-4 text-red-500" : "h-4 w-4 text-amber-500"} />
      <span className="flex-1">
        <strong>{n}</strong> {n === 1 ? "coisa" : "coisas"} para conferir nos seus números
        (estoque, contas ou vendas).
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
