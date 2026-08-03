import { describe, it, expect } from "vitest";
import { salesService } from "../sales.service";
import { financeService } from "@/features/finance/services/finance.service";
import { supabase } from "@/integrations/supabase/client";

// Mock para simular ambiente de teste
const COMPANY_ID = "00000000-0000-0000-0000-000000000001"; // ID fictício para testes controlados

describe("Fluxo de Venda com Pagamento Pendente (Sprint Limbo)", () => {
  it("deve criar um Contas a Receber automaticamente ao criar venda sem pagamento", async () => {
    // 1. Criar uma venda sem payment_method
    const sale = await salesService.create({
      company_id: COMPANY_ID,
      status: "pending",
      payment_method: null,
      items: [
        {
          product_id: null,
          description: "Produto Teste",
          quantity: 1,
          unit_price: 100,
          discount: 0,
        }
      ]
    }, { origin: "pdv" });

    expect(sale.id).toBeDefined();

    // 2. Verificar se existe um lançamento financeiro vinculado
    const { data: tx } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("reference_id", sale.id)
      .eq("source", "sale")
      .single();

    if (!tx) throw new Error("Lançamento financeiro não criado");

    expect(tx.status).toBe("pending");
    expect(Number(tx.amount)).toBe(100);
  });

  it("deve liquidar a venda corretamente ao baixar o financeiro", async () => {
    // 1. Criar venda e pegar o ID do financeiro
    const sale = await salesService.create({
      company_id: COMPANY_ID,
      status: "pending",
      payment_method: null,
      items: [{ product_id: null, description: "Teste Liq", quantity: 1, unit_price: 50, discount: 0 }]
    }, { origin: "pdv" });

    const { data: tx } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("reference_id", sale.id)
      .single();

    if (!tx) throw new Error("Lançamento financeiro não criado");

    // 2. Liquidar o financeiro
    // Pegar uma conta ativa para o teste
    const accounts = await financeService.listAccounts(COMPANY_ID);
    const account = accounts.find(a => a.status === 'active');
    
    if (!account) throw new Error("Conta ativa necessária para o teste");

    await financeService.settleTransaction(tx.id, {
      paymentMethod: "pix",
      accountId: account.id,
      paidAt: new Date().toISOString().slice(0, 10),
      settledAmount: 50
    });

    // 3. Verificar se a venda mudou para 'paid'
    const { data: updatedSale } = await supabase
      .from("sales")
      .select("status, paid_at")
      .eq("id", sale.id)
      .single();

    if (!updatedSale) throw new Error("Venda não encontrada");

    expect(updatedSale.status).toBe("paid");
    expect(updatedSale.paid_at).toBeDefined();
  });
});

