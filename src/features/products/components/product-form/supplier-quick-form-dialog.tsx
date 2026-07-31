import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplierForm } from "@/features/suppliers/components/supplier-form";
import { suppliersKeys } from "@/features/suppliers/hooks/use-suppliers";
import { productsKeys } from "../../hooks/use-products";
import type { ProductSupplier } from "../../types";

interface Props {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: ProductSupplier) => void;
}

/**
 * Reutiliza o `SupplierForm` completo em modo dialog para manter regras,
 * validações e campos alinhados ao cadastro oficial de Fornecedores.
 */
export function SupplierQuickFormDialog({
  companyId,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const qc = useQueryClient();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo fornecedor</DialogTitle>
          <DialogDescription>
            Cadastro completo. O fornecedor será selecionado automaticamente no
            produto após salvar.
          </DialogDescription>
        </DialogHeader>

        <SupplierForm
          companyId={companyId}
          variant="dialog"
          onCancel={() => onOpenChange(false)}
          onSaved={(saved) => {
            qc.invalidateQueries({ queryKey: productsKeys.suppliers(companyId) });
            qc.invalidateQueries({ queryKey: suppliersKeys.all });
            onCreated(saved as ProductSupplier);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
