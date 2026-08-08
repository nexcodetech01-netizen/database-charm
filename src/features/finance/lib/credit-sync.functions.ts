import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const getCreditInstallmentByTransaction = createServerFn({ method: "GET" })
  .handler(async ({ data: { transactionId } }: { data: { transactionId: string } }) => {
    // Busca se existe um lançamento de crediário (installment) vinculado a esta transação financeira.
    // Lançamentos de crediário costumam ter source = 'credit_payment' ou estarem vinculados via reference_id.
    const { data: tx, error: txError } = await supabase
      .from("financial_transactions")
      .select("source, reference_id, reference_number, company_id")
      .eq("id", transactionId)
      .single();

    if (txError || !tx) return null;

    // Se a origem for 'sale', verificamos se essa venda tem crediário.
    if (tx.source === "sale" && tx.reference_id) {
       const { data: creditAcc } = await supabase
         .from("credit_accounts")
         .select("id")
         .eq("sale_id", tx.reference_id)
         .maybeSingle();
       
       if (creditAcc) {
         return { creditAccountId: creditAcc.id, type: 'account' };
       }
    }

    return null;
  });
