import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, MessageCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CatalogStats {
  visitors: number;
  product_views: number;
  whatsapp_clicks: number;
  daily: { day: string; visitors: number; product_views: number; whatsapp_clicks: number }[];
  top_products: { product_id: string; name: string; views: number; clicks: number }[];
}

const PERIODS = [7, 30] as const;

/** Visitas, peças vistas e cliques no WhatsApp do catálogo público. */
export function CatalogStatsCard({ companyId }: { companyId: string }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7);
  const q = useQuery({
    queryKey: ["catalog-stats", companyId, days],
    staleTime: 60_000,
    queryFn: async (): Promise<CatalogStats | null> => {
      // Função nova (migration 20261026190000); tipos ainda não gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("catalog_stats", {
        _company_id: companyId,
        _days: days,
      });
      if (error) return null; // SQL ainda não rodado
      return data as CatalogStats;
    },
  });

  const s = q.data;
  const maxDay = Math.max(1, ...(s?.daily ?? []).map((d) => d.visitors));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Desempenho do catálogo</CardTitle>
        <div className="flex rounded-md border p-0.5 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              className={cn(
                "rounded px-2 py-1",
                days === p ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {p} dias
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !s ? (
          <p className="text-sm text-muted-foreground">
            As métricas começam a contar depois que o SQL do catálogo for rodado no Supabase.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={Users} label="Visitantes" value={s.visitors} />
              <Stat icon={Eye} label="Peças vistas" value={s.product_views} />
              <Stat icon={MessageCircle} label="Cliques no WhatsApp" value={s.whatsapp_clicks} />
            </div>

            {s.visitors === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguém visitou o catálogo neste período. Compartilhe o link de uma coleção ou de
                uma peça no Instagram e no status do WhatsApp. Visitas suas, logada no NexOS, não
                contam.
              </p>
            ) : (
              <>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Visitantes por dia
                  </p>
                  <div className="flex h-16 items-end gap-1">
                    {s.daily.map((d) => (
                      <div
                        key={d.day}
                        title={`${d.day.split("-").reverse().join("/")}: ${d.visitors} visitante(s)`}
                        className="flex-1 rounded-t bg-primary/70"
                        style={{ height: `${Math.max(6, (d.visitors / maxDay) * 100)}%` }}
                      />
                    ))}
                  </div>
                </div>
                {s.top_products.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Peças mais vistas
                    </p>
                    <ul className="divide-y text-sm">
                      {s.top_products.map((p) => (
                        <li
                          key={p.product_id}
                          className="flex items-center justify-between gap-2 py-1.5"
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {p.views} {p.views === 1 ? "vista" : "vistas"} · {p.clicks} no WhatsApp
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <Icon className="mb-1 h-4 w-4 text-muted-foreground" />
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
