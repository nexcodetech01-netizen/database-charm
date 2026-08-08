import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "../customer-form";
import { UserPlus } from "lucide-react";

type Props = {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (customer: any) => void;
};

export function PDVCustomerQuickCreate({
  companyId,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Cadastro Rápido de Cliente
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-1 py-4">
          <CustomerForm
            companyId={companyId}
            onSaved={(customer) => {
              onSaved(customer);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
