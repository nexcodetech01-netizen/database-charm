import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/layout/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Megaphone, Pencil, Trash2 } from "lucide-react";
import {
  CAMPAIGN_CHANNEL_OPTIONS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_OPTIONS,
  type CampaignChannel,
  type CampaignStatus,
  type MarketingCampaign,
} from "../types";

const channelLabel = (v: string) =>
  CAMPAIGN_CHANNEL_OPTIONS.find((o) => o.value === v)?.label ?? v;
const statusLabel = (v: string) =>
  CAMPAIGN_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;

export function CampaignTable({
  campaigns,
  onEdit,
  onDelete,
}: {
  campaigns: MarketingCampaign[];
  onEdit: (c: MarketingCampaign) => void;
  onDelete: (c: MarketingCampaign) => void;
}) {
  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Nenhuma campanha registrada"
        description="Crie sua primeira campanha para acompanhar leads e conversões."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campanha</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead className="text-right">Orçamento</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Conv.</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="w-[100px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((c) => {
            const leads = c.leads_count ?? 0;
            const conv = c.conversions_count ?? 0;
            const rate = leads > 0 ? (conv / leads) * 100 : 0;
            const start = c.started_at ?? c.scheduled_for ?? null;
            return (
              <TableRow key={c.id} className="hover:bg-muted/40">
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  {c.objective ? (
                    <div className="text-xs text-muted-foreground">{c.objective}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">{channelLabel(c.channel as CampaignChannel)}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(CAMPAIGN_STATUS_COLORS[c.status as CampaignStatus])}
                  >
                    {statusLabel(c.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {start ? formatDate(start) : "—"}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(Number(c.budget ?? 0))}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{leads}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {conv}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    ({rate.toFixed(0)}%)
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums">
                  {formatCurrency(Number(c.revenue_generated ?? 0))}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:text-danger"
                    onClick={() => onDelete(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
