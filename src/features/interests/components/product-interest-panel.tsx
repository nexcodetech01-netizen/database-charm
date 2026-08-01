import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HeartHandshake, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/design";
import { useProductInterests } from "../hooks/use-interests";
import { summarizeInterests, stockBackInterestNotice } from "../lib/interest-insights";
import { InterestForm } from "./interest-form";
import { InterestTable } from "./interest-table";

/**
 * Bloco "Clientes aguardando" na ficha do produto (somente leitura + registro).
 */
export function ProductInterestPanel({
  companyId,
  productId,
  stock,
}: {
  companyId: string;
  productId: string;
  stock: number;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useProductInterests(productId);
  const rows = data ?? [];
  const summary = summarizeInterests(rows);
  const notice = stockBackInterestNotice({ stock, waiting: summary.openCount });

  return (
    <Section
      title="Clientes aguardando"
      description="Interesses registrados para este produto. Não reserva estoque."
      actions={
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Registrar interesse
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-2xl font-semibold">{summary.openCount}</span>
          <span className="text-sm text-muted-foreground">
            {summary.openCount === 1 ? "cliente aguardando" : "clientes aguardando"}
          </span>
          <Link
            to="/comercial/lista-interesse"
            className="ml-auto text-sm text-primary hover:underline"
          >
            Ver lista
          </Link>
        </div>

        {notice && (
          <p className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
            {notice}
          </p>
        )}

        <InterestTable rows={rows} hideProduct />
      </div>

      <InterestForm
        companyId={companyId}
        productId={productId}
        open={open}
        onOpenChange={setOpen}
      />
    </Section>
  );
}
