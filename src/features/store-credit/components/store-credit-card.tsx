import { Repeat } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useStoreCreditBalance, useStoreCreditEntries } from "../hooks/use-store-credit";

const KIND_LABEL: Record<string, string> = {
  exchange: "Troca",
  sale_use: "Usado em compra",
  sale_cancel: "Devolvido ao saldo",
  adjustment: "Ajuste",
};

/** Saldo e extrato do vale-troca da cliente (Cliente 360). */
export function StoreCreditCard({ customerId }: { customerId: string }) {
  const balance = useStoreCreditBalance(customerId);
  const entries = useStoreCreditEntries(customerId);

  if (balance.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }
  // SQL ainda não rodado: não mostra o card.
  if (balance.data === null || balance.data === undefined) return null;

  const list = entries.data ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Vale-troca</h3>
        </div>
        <span
          className={cn(
            "text-lg font-semibold tabular-nums",
            balance.data > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {formatCurrency(balance.data)}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Sem trocas. O vale aparece aqui quando você usar &quot;Trocar&quot; numa venda dela.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border text-sm">
          {list.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0">
                <span className="block truncate">{KIND_LABEL[e.kind] ?? e.kind}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatDate(e.created_at)}
                  {e.notes ? ` · ${e.notes}` : ""}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  e.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                {e.amount > 0 ? "+" : "−"}
                {formatCurrency(Math.abs(e.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
