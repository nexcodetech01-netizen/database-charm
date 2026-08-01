import { Link } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/layout";
import { HeartHandshake } from "lucide-react";
import { InterestStatusBadge } from "./interest-status-badge";
import {
  INTEREST_CHANNEL_LABEL,
  INTEREST_STATUS_OPTIONS,
  type InterestStatus,
  type ProductInterestRow,
} from "../types";

interface Props {
  rows: ProductInterestRow[];
  onStatusChange?: (id: string, status: InterestStatus) => void;
  hideProduct?: boolean;
}

const date = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");

export function InterestTable({ rows, onStatusChange, hideProduct }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={HeartHandshake}
        title="Nenhum interesse registrado"
        description="Registre o desejo de clientes por produtos indisponíveis para acompanhar a demanda."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          {!hideProduct && <TableHead>Produto</TableHead>}
          <TableHead>Canal</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Situação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.customer_name}</p>
                <p className="text-xs text-muted-foreground">{row.phone ?? "—"}</p>
              </div>
            </TableCell>
            {!hideProduct && (
              <TableCell>
                {row.product ? (
                  <Link
                    to="/produtos/$productId"
                    params={{ productId: row.product.id }}
                    className="text-sm hover:underline"
                  >
                    {row.product.name}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
            )}
            <TableCell className="text-sm text-muted-foreground">
              {INTEREST_CHANNEL_LABEL[row.channel]}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {date(row.interest_date)}
            </TableCell>
            <TableCell>
              {onStatusChange ? (
                <Select
                  value={row.status}
                  onValueChange={(v) => onStatusChange(row.id, v as InterestStatus)}
                >
                  <SelectTrigger className="h-8 w-[190px]" aria-label="Situação do interesse">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEREST_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <InterestStatusBadge status={row.status} />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
