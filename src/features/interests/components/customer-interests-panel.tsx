import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/design";
import { useCustomerInterests } from "../hooks/use-interests";
import { InterestForm } from "./interest-form";
import { InterestTable } from "./interest-table";

/** Aba "Interesses" da ficha do cliente. */
export function CustomerInterestsPanel({
  companyId,
  customerId,
  customerName,
}: {
  companyId: string;
  customerId: string;
  customerName: string;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useCustomerInterests(customerId);

  return (
    <Section
      title="Lista de interesse"
      description="Produtos que este cliente deseja. Não gera venda nem reserva estoque."
      actions={
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Registrar interesse
        </Button>
      }
    >
      <InterestTable rows={data ?? []} />
      <InterestForm
        companyId={companyId}
        customerId={customerId}
        customerName={customerName}
        open={open}
        onOpenChange={setOpen}
      />
    </Section>
  );
}
