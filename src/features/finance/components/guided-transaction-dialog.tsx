import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { TransactionType } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

type Step = "choice" | "form";

export function GuidedTransactionDialog({ open, onOpenChange, companyId }: Props) {
  const [step, setStep] = useState<Step>("choice");
  const [type, setType] = useState<TransactionType>("income");
  const [isReimbursement, setIsReimbursement] = useState(false);

  function handleChoice(t: TransactionType, reimbursement = false) {
    setType(t);
    setIsReimbursement(reimbursement);
    setStep("form");
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setStep("choice");
      setIsReimbursement(false);
    }, 300);
  }

  return (
    <>
      <Dialog open={open && step === "choice"} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">O que você deseja registrar?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="flex h-24 flex-col items-center justify-center gap-2 border-success/30 bg-success/5 hover:bg-success/10 hover:text-success hover:border-success"
              onClick={() => handleChoice("income")}
            >
              <ArrowDownCircle className="h-8 w-8 text-success" />
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">Entrada de Venda / Cliente</span>
                <span className="text-xs text-muted-foreground font-normal">Dinheiro que entrou de clientes</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="flex h-24 flex-col items-center justify-center gap-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:text-primary hover:border-primary"
              onClick={() => handleChoice("income", true)}
            >
              <Wallet className="h-8 w-8 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">Dinheiro Pessoal Colocado na Loja</span>
                <span className="text-xs text-muted-foreground font-normal">Aporte de sócio / Investimento do dono</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="flex h-24 flex-col items-center justify-center gap-2 border-destructive/30 bg-destructive/5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
              onClick={() => handleChoice("expense")}
            >
              <ArrowUpCircle className="h-8 w-8 text-destructive" />
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">Conta / Despesa a Pagar</span>
                <span className="text-xs text-muted-foreground font-normal">Boletos, aluguel, fornecedores, etc.</span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionFormDialog
        open={open && step === "form"}
        onOpenChange={(v) => {
          if (!v) handleClose();
        }}
        companyId={companyId}
        defaultType={type}
        initialIsReimbursement={isReimbursement}
      />
    </>
  );
}
