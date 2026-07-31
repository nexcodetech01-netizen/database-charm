import { useMemo, useState } from "react";
import {
  Copy,
  Download,
  MessageCircle,
  Search,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { EmptyState, KpiCard, KpiSection } from "@/components/layout";
import { formatCurrency, formatNumber } from "@/lib/format";
import { BR_STATES } from "@/features/customers/types";
import { useCategoriesList } from "@/features/categories";
import { useCampaignAudience } from "../hooks/use-campaign-audience";
import {
  audienceToCsv,
  SEGMENT_PRESET_OPTIONS,
  type CampaignAudienceCriteria,
  type SegmentPreset,
} from "../services/campaign-audience.service";

const PAYMENT_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
  { value: "transfer", label: "Transferência" },
];

export function CampaignsWorkspace({ companyId }: { companyId: string }) {
  const [criteria, setCriteria] = useState<CampaignAudienceCriteria>({
    preset: "all",
    name: "",
    city: "",
    state: "",
    categoryId: "",
    paymentMethod: "",
    minTotalSpent: null,
    minPurchaseCount: null,
    periodStart: null,
    periodEnd: null,
  });

  const audienceQ = useCampaignAudience(companyId, criteria);
  const catQ = useCategoriesList(companyId);
  const categories = catQ.data ?? [];

  const preview = audienceQ.data?.preview;
  const rows = audienceQ.data?.customers ?? [];

  function update<K extends keyof CampaignAudienceCriteria>(
    key: K,
    value: CampaignAudienceCriteria[K],
  ) {
    setCriteria((c) => ({ ...c, [key]: value }));
  }

  function reset() {
    setCriteria({
      preset: "all",
      name: "",
      city: "",
      state: "",
      categoryId: "",
      paymentMethod: "",
      minTotalSpent: null,
      minPurchaseCount: null,
      periodStart: null,
      periodEnd: null,
    });
  }

  function exportCsv() {
    if (rows.length === 0) {
      toast.info("Sem clientes para exportar");
      return;
    }
    const csv = audienceToCsv(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanha-audiencia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} clientes exportados`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <BuilderCard
          criteria={criteria}
          onChange={update}
          onReset={reset}
          categories={categories}
        />

        <div className="min-w-0 space-y-4">
          <PreviewKpis loading={audienceQ.isLoading} preview={preview} />
          <AudienceListCard
            loading={audienceQ.isLoading}
            rows={rows}
            onExport={exportCsv}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BuilderCard({
  criteria,
  onChange,
  onReset,
  categories,
}: {
  criteria: CampaignAudienceCriteria;
  onChange: <K extends keyof CampaignAudienceCriteria>(
    key: K,
    value: CampaignAudienceCriteria[K],
  ) => void;
  onReset: () => void;
  categories: { id: string; name: string }[];
}) {
  return (
    <Card className="lg:sticky lg:top-20 lg:self-start">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Lista inteligente
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Combine um segmento com filtros para gerar a audiência.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Segmento">
          <Select
            value={criteria.preset}
            onValueChange={(v) => onChange("preset", v as SegmentPreset)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENT_PRESET_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <Input
              value={criteria.name ?? ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Buscar…"
            />
          </Field>
          <Field label="Cidade">
            <Input
              value={criteria.city ?? ""}
              onChange={(e) => onChange("city", e.target.value)}
              placeholder="Cidade"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="UF">
            <Select
              value={criteria.state || "__all"}
              onValueChange={(v) => onChange("state", v === "__all" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {BR_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Categoria favorita">
            <Select
              value={criteria.categoryId || "__all"}
              onValueChange={(v) =>
                onChange("categoryId", v === "__all" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Forma de pagamento preferida">
          <Select
            value={criteria.paymentMethod || "__all"}
            onValueChange={(v) =>
              onChange("paymentMethod", v === "__all" ? "" : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Qualquer</SelectItem>
              {PAYMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gasto mínimo (R$)">
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={criteria.minTotalSpent ?? ""}
              onChange={(e) =>
                onChange(
                  "minTotalSpent",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label="Compras mínimas">
            <Input
              type="number"
              min={0}
              value={criteria.minPurchaseCount ?? ""}
              onChange={(e) =>
                onChange(
                  "minPurchaseCount",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Período — início">
            <Input
              type="date"
              value={criteria.periodStart ?? ""}
              onChange={(e) =>
                onChange("periodStart", e.target.value || null)
              }
            />
          </Field>
          <Field label="Período — fim">
            <Input
              type="date"
              value={criteria.periodEnd ?? ""}
              onChange={(e) => onChange("periodEnd", e.target.value || null)}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Limpar filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PreviewKpis({
  loading,
  preview,
}: {
  loading: boolean;
  preview:
    | {
        count: number;
        totalPurchased: number;
        averageTicket: number;
        lastPurchaseAt: string | null;
      }
    | undefined;
}) {
  return (
    <KpiSection>
      <KpiCard
        label="Clientes"
        value={preview ? formatNumber(preview.count) : "0"}
        icon={Users}
        loading={loading}
      />
      <KpiCard
        label="Total comprado"
        value={preview ? formatCurrency(preview.totalPurchased) : "R$ 0,00"}
        icon={Target}
        loading={loading}
      />
      <KpiCard
        label="Ticket médio"
        value={preview ? formatCurrency(preview.averageTicket) : "R$ 0,00"}
        icon={Sparkles}
        loading={loading}
      />
      <KpiCard
        label="Última compra"
        value={
          preview?.lastPurchaseAt
            ? new Date(preview.lastPurchaseAt).toLocaleDateString("pt-BR")
            : "—"
        }
        icon={Search}
        loading={loading}
      />
    </KpiSection>
  );
}

/* ------------------------------------------------------------------ */

function AudienceListCard({
  loading,
  rows,
  onExport,
}: {
  loading: boolean;
  rows: import("../services/campaign-audience.service").CampaignAudienceCustomer[];
  onExport: () => void;
}) {
  const empty = !loading && rows.length === 0;
  const displayed = useMemo(() => rows.slice(0, 500), [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Audiência</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loading
              ? "Calculando…"
              : `${rows.length} clientes${rows.length > displayed.length ? ` (mostrando ${displayed.length})` : ""}`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onExport} disabled={loading || empty}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar CSV
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : empty ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente na audiência"
            description="Ajuste os filtros para encontrar clientes."
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Última compra</TableHead>
                  <TableHead className="text-right">Dias sem comprar</TableHead>
                  <TableHead className="text-right">Total gasto</TableHead>
                  <TableHead className="w-[1%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((r) => (
                  <AudienceRow key={r.id} row={r} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AudienceRow({
  row,
}: {
  row: import("../services/campaign-audience.service").CampaignAudienceCustomer;
}) {
  const phone = row.whatsapp ?? row.phone ?? "";
  const waHref = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}`
    : null;
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          {row.favoriteCategoryName ? (
            <span className="text-xs text-muted-foreground">
              {row.favoriteCategoryName}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {phone || <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {row.city ? (
          <span>
            {row.city}
            {row.state ? `/${row.state}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {row.lastPurchaseAt
          ? new Date(row.lastPurchaseAt).toLocaleDateString("pt-BR")
          : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.daysSinceLast != null ? (
          <Badge variant="outline" className="tabular-nums">
            {row.daysSinceLast}d
          </Badge>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatCurrency(row.totalSpent)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {waHref ? (
            <Button
              asChild
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Abrir WhatsApp"
            >
              <a href={waHref} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {phone ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Copiar telefone"
              onClick={() => copy(phone, "Telefone copiado")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
          {row.email ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Copiar e-mail"
              onClick={() => copy(row.email!, "E-mail copiado")}
            >
              <Copy className="h-4 w-4 opacity-60" />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function copy(value: string, msg: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(msg))
    .catch(() => toast.error("Não foi possível copiar"));
}
