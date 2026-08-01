import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HeartHandshake, Plus } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/design";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  DEFAULT_INTEREST_FILTERS,
  INTEREST_CHANNEL_OPTIONS,
  INTEREST_STATUS_OPTIONS,
  InterestBellaHints,
  InterestForm,
  InterestTable,
  buildInterestInsights,
  summarizeInterests,
  useInterestsList,
  useSetInterestStatus,
  type InterestChannel,
  type InterestStatus,
} from "@/features/interests";

export const Route = createFileRoute("/_authenticated/comercial/lista-interesse")({
  beforeLoad: requirePermission("sales.view"),
  component: InterestListPage,
});

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function InterestListPage() {
  const { company } = Route.useRouteContext();
  const [filters, setFilters] = useState(DEFAULT_INTEREST_FILTERS);
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debounced }),
    [filters, debounced],
  );

  const { data, isLoading } = useInterestsList(company.id, effective);
  const setStatus = useSetInterestStatus();
  const rows = data ?? [];
  const summary = useMemo(() => summarizeInterests(rows), [rows]);
  const insights = useMemo(() => buildInterestInsights(summary), [summary]);

  return (
    <PageLayout
      icon={HeartHandshake}
      title="Lista de interesse"
      description="Quem está esperando o quê? Registre o desejo de clientes por produtos indisponíveis. Não gera venda nem reserva estoque."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Registrar interesse
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Section title="Clientes aguardando">
            <p className="text-3xl font-semibold">{summary.waitingCustomers}</p>
          </Section>
          <Section title="Produtos aguardados">
            <p className="text-3xl font-semibold">{summary.waitedProducts}</p>
          </Section>
          <Section title="Potencial de vendas">
            <p className="text-3xl font-semibold">{BRL(summary.potential)}</p>
          </Section>
        </div>

        <InterestBellaHints insights={insights} />

        <Section
          title="Interesses"
          description="Acompanhe a demanda e atualize a situação de cada registro."
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Buscar por cliente, telefone ou observação"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              aria-label="Buscar interesses"
            />
            <Select
              value={filters.status || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  status: v === "all" ? "" : (v as InterestStatus),
                }))
              }
            >
              <SelectTrigger aria-label="Filtrar por situação">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                {INTEREST_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.channel || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  channel: v === "all" ? "" : (v as InterestChannel),
                }))
              }
            >
              <SelectTrigger aria-label="Filtrar por canal">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                {INTEREST_CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <InterestTable
              rows={rows}
              onStatusChange={(id, status) => setStatus.mutate({ id, status })}
            />
          )}
        </Section>
      </div>

      <InterestForm companyId={company.id} open={open} onOpenChange={setOpen} />
    </PageLayout>
  );
}
