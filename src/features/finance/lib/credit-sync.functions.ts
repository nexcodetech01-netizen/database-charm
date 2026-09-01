import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ transactionId: z.string() });

export const getCreditInstallmentByTransaction = createServerFn({ method: "GET" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data: { transactionId } }) => {
    // BUG ENCONTRADO E CORRIGIDO (2026-08-31): essa função usava o
    // cliente Supabase genérico do navegador — funciona numa tela
    // normal (o navegador já tem sessão), mas rodando aqui do
    // SERVIDOR, esse cliente não tem sessão nenhuma, roda como
    // anônimo, e o RLS bloqueia a leitura — a função sempre retornava
    // null, mesmo quando o vínculo com crediário existia de verdade.
    // Consequência real: em `settle-transaction-dialog.tsx`, a baixa
    // de um lançamento vinculado a crediário deveria sincronizar a
    // parcela automaticamente — mas como essa consulta sempre vinha
    // vazia, essa sincronização nunca rodava.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Busca se existe um lançamento de crediário (installment) vinculado a esta transação financeira.
    const { data: tx, error: txError } = await supabaseAdmin
      .from("financial_transactions")
      .select("source, reference_id, reference_number, company_id")
      .eq("id", transactionId)
      .single();

    if (txError || !tx) return null;

    // Se a origem for 'sale', verificamos se essa venda tem crediário.
    if (tx.source === "sale" && tx.reference_id) {
       const { data: creditAcc } = await supabaseAdmin
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


