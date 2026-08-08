import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const inputSchema = z.object({ transactionId: z.string() });

export const getCreditInstallmentByTransaction = createServerFn({ method: "GET" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data: { transactionId } }) => {
    // Busca se existe um lançamento de crediário (installment) vinculado a esta transação financeira.
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
         return { creditAccountId: creditAcc.id, type: 'account' as const };
       }
    }

    return null;
  });


