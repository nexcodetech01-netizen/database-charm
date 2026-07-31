import { useQuery } from "@tanstack/react-query";
import { salesService } from "../../services/sales.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Props = {
  companyId: string;
  value: string;
  onChange: (customerId: string) => void;
};

/**
 * PDV — seleção do cliente da venda (obrigatória pela regra existente do
 * SaleEngine). Reutiliza `salesService.listActiveCustomers`.
 */
export function PDVCustomerSelect({ companyId, value, onChange }: Props) {
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["sales", "customers", companyId],
    queryFn: () => salesService.listActiveCustomers(companyId),
    enabled: !!companyId,
  });

  return (
    <div className="space-y-1.5 rounded-xl border bg-card p-5 shadow-sm">
      <Label className="text-xs text-muted-foreground">Cliente</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id="pdv-customer" className="h-11">
          <SelectValue
            placeholder={isLoading ? "Carregando..." : "Selecione o cliente"}
          />
        </SelectTrigger>
        <SelectContent>
          {customers.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
