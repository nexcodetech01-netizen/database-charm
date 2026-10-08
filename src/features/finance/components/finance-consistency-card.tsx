import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";

interface ConsistencyIssue {
  problem: string;
  sale_id: string;
  sale_number: string;
  customer: string | null;
  sale_status: string;
  total: number;
  detail: string;
}

/**
 * Raio-X do financeiro (RPC finance_consistency_issues): vendas em que o
 * status, o crediário e o Financeiro não batem. Só aparece quando há algo
 * errado — para nenhum problema ficar escondido até alguém esbarrar.
 */
export function FinanceConsistencyCard({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const { data: issues } = useQuery({
    queryKey: ["finance", "consistency", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ConsistencyIssue[]> => {
      const { data, error } = await (supabase.rpc as any)("finance_consistency_issues", {
        _company_id: companyId,
      });
      // Função ainda não criada no banco: não mostra nada.
      if (error) return [];
      return (data ?? []) as ConsistencyIssue[];
    },
  });

  if (!issues || issues.length === 0) return null;

  return (
    <Card className="rounded-2xl border-amber-500/40 bg-amber-500/5">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">
                {issues.length} venda{issues.length === 1 ? "" : "s"} com o financeiro inconsistente
              </p>
              <p className="text-xs text-muted-foreground">
                O status da venda, o crediário e os recebimentos não batem. Os números do fechamento
                podem estar errados até corrigir.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} className="shrink-0">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        {open ? (
          <ul className="divide-y rounded-md border bg-background text-xs">
            {issues.map((i) => (
              <li key={`${i.problem}-${i.sale_id}`} className="flex justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{i.problem}</p>
                  <p className="text-muted-foreground">
                    {i.sale_number} · {i.customer ?? "sem cliente"} · {i.detail}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums">{formatCurrency(Number(i.total))}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
