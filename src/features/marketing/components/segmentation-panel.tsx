import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUSTOMER_SEGMENT_OPTIONS, BR_STATES } from "@/features/customers";
import { useSegmentCustomers } from "../hooks/use-marketing";
import type { SegmentFilters } from "../types";
import { Users } from "lucide-react";

export function SegmentationPanel({ companyId }: { companyId: string }) {
  const [filters, setFilters] = useState<SegmentFilters>({});
  const [enabled, setEnabled] = useState(false);

  const { data, isFetching } = useSegmentCustomers(companyId, filters, enabled);

  const update = <K extends keyof SegmentFilters>(k: K, v: SegmentFilters[K]) =>
    setFilters((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de segmentação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Cidade</Label>
            <Input
              value={filters.city ?? ""}
              onChange={(e) => update("city", e.target.value || undefined)}
              placeholder="São Paulo"
            />
          </div>
          <div>
            <Label>Estado</Label>
            <Select
              value={filters.state ?? "all"}
              onValueChange={(v) => update("state", v === "all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {BR_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Segmento</Label>
            <Select
              value={filters.segment ?? "all"}
              onValueChange={(v) => update("segment", v === "all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {CUSTOMER_SEGMENT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Comprou nos últimos (dias)</Label>
            <Input
              type="number"
              min={1}
              value={filters.purchasedWithinDays ?? ""}
              onChange={(e) =>
                update("purchasedWithinDays", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Ex: 30"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!filters.neverPurchased}
              onCheckedChange={(v) => update("neverPurchased", !!v)}
              id="never"
            />
            <Label htmlFor="never" className="!mt-0 text-sm font-normal">
              Nunca comprou
            </Label>
          </div>
          <div>
            <Label>Ticket médio mínimo (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={filters.minAverageTicket ?? ""}
              onChange={(e) =>
                update("minAverageTicket", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div>
            <Label>Total gasto mínimo (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={filters.minTotalSpent ?? ""}
              onChange={(e) =>
                update("minTotalSpent", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <Button className="w-full" onClick={() => setEnabled(true)}>
            Aplicar segmentação
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Resultado</CardTitle>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {data?.length ?? 0} clientes
          </div>
        </CardHeader>
        <CardContent>
          {!enabled ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Ajuste os filtros e clique em "Aplicar segmentação".
            </div>
          ) : isFetching ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum cliente corresponde aos filtros.
            </div>
          ) : (
            <ul className="divide-y">
              {(data ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[c.email, c.city && c.state ? `${c.city}/${c.state}` : c.state]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </div>
                  {c.segment ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {c.segment}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
