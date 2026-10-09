import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIT_AREAS, AuditEntryItem, useAuditActors, useAuditList, type AuditArea } from "@/features/audit";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de alterações — NexOS" },
      { name: "description", content: "Consulte alterações por área, responsável e período no NexOS." },
      { property: "og:title", content: "Histórico de alterações — NexOS" },
      { property: "og:description", content: "Histórico de alterações da empresa, com filtros por área, responsável e período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: requirePermission("audit.view"),
  component: AuditPage,
});

const PAGE_SIZE = 50;
const ALL = "__all";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AuditPage() {
  const { company } = Route.useRouteContext();
  const [area, setArea] = useState<AuditArea | "">("");
  const [actorId, setActorId] = useState("");
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({ companyId: company.id, area, actorId, from, to, page, pageSize: PAGE_SIZE }),
    [company.id, area, actorId, from, to, page],
  );
  const { data, isLoading, isFetching } = useAuditList(filters);
  const { data: actors = [] } = useAuditActors(company.id);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function update<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <PageLayout
      title="Histórico de alterações"
      meta={isLoading ? "Carregando..." : `${total} registro${total === 1 ? "" : "s"}`}
    >
      <div className="space-y-4">
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Área</Label>
            <Select value={area || ALL} onValueChange={(v) => update(setArea)(v === ALL ? "" : (v as AuditArea))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {(Object.keys(AUDIT_AREAS) as AuditArea[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {AUDIT_AREAS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quem</Label>
            <Select value={actorId || ALL} onValueChange={(v) => update(setActorId)(v === ALL ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {actors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
                <SelectItem value="none">Sistema / automações</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => update(setFrom)(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => update(setTo)(e.target.value)} />
          </div>
        </div>

        <div className="rounded-md border px-4">
          {isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : (data?.rows ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <History className="h-6 w-6" />
              Nenhuma alteração encontrada com esses filtros.
            </div>
          ) : (
            <ul className={`divide-y ${isFetching ? "opacity-60" : ""}`}>
              {(data?.rows ?? []).map((e) => (
                <AuditEntryItem key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </div>

        {pages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {page} / {pages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}
