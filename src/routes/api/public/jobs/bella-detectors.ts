/**
 * Job: Detecção de estoque baixo e contas vencidas.
 * 
 * Orquestra a execução dos detectores da Bella IA em escala,
 * buscando dados de todas as empresas ativas e emitindo eventos
 * para o BellaEventEngine (que por sua vez persiste na Fase 1).
 */
import { createFileRoute } from "@tanstack/react-router";
import { authorizeJobRequest } from "@/lib/job-auth.server";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { runJob } from "@/lib/job-runs.server";
import { requireServiceKey } from "@/lib/job-admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  criticalStockDetector,
  outOfStockDetector,
  possibleDuplicateProductDetector,
  type DuplicateProductGroup,
} from "@/features/bella-ai/events/detectors/inventory.detectors";
import { overdueInvoiceDetector } from "@/features/bella-ai/events/detectors/finance.detectors";
import { bellaEventEngine } from "@/features/bella-ai/events/BellaEventEngine";
import { bellaEventRegistry } from "@/features/bella-ai/events/BellaEventRegistry";


export const Route = createFileRoute("/api/public/jobs/bella-detectors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rateLimit = enforceRateLimit({
          route: "jobs:bella-detectors",
          windowMs: 60_000,
          max: 10,
        });
        if (rateLimit) return rateLimit;

        const denied = authorizeJobRequest(request);
        if (denied) return denied;

        const noServiceKey = requireServiceKey("bella-detectors");
        if (noServiceKey) return noServiceKey;

        // Garantir que o Registry está ouvindo antes de começar (Singleton)
        bellaEventRegistry.start();

        return runJob("bella-detectors", async () => {
          const results = {
            inventory: { processed: 0, emitted: 0 },
            finance: { processed: 0, emitted: 0 },
            duplicates: { processed: 0, emitted: 0 },
            errors: [] as string[],
          };

          try {
            // 1. Buscar todas as empresas ativas
            const { data: companies, error: compError } = await supabaseAdmin
              .from("companies")
              .select("id, name");

            if (compError) throw compError;

            // Filtro manual para evitar erro de tipo no .neq() se a coluna 'name' tiver restrições
            const activeCompanies = (companies || []).filter(c => c.name !== "DELETED");

            for (const company of activeCompanies) {
              const tenantId = company.id;
              const now = new Date();

              // --- EXECUÇÃO ESTOQUE ---
              try {
                const { data: products, error: prodError } = await supabaseAdmin
                  .from("products")
                  .select("id, name, stock, min_stock, status")
                  .eq("company_id", tenantId);

                if (prodError) throw prodError;

                // Filtro manual de status para evitar problemas de tipo no query builder
                const activeProducts = (products || []).filter(p => p.status === "active");

                const snapshots = activeProducts.map(p => ({
                  productId: p.id,
                  name: p.name,
                  stock: Number(p.stock || 0),
                  minStock: Number(p.min_stock || 0)
                }));

                // Rodar os dois detectores de estoque
                const ctx = { tenantId, now };
                const resCritical = criticalStockDetector.detect(snapshots, ctx);
                const resOut = outOfStockDetector.detect(snapshots, ctx);

                [...resCritical.emit, ...resOut.emit].forEach(evt => {
                  bellaEventEngine.emit(evt);
                  results.inventory.emitted++;
                });
                results.inventory.processed += snapshots.length;

              } catch (err: any) {
                results.errors.push(`Inventory Error (${tenantId}): ${err.message}`);
              }

              // --- EXECUÇÃO FINANCEIRO ---
              try {
                // Apenas transações pendentes cuja data de vencimento passou
                const todayStr = now.toISOString().split('T')[0];
                const { data: invoices, error: invError } = await supabaseAdmin
                  .from("financial_transactions")
                  .select("id, amount, due_date, status")
                  .eq("company_id", tenantId)
                  .lt("due_date", todayStr);

                if (invError) throw invError;

                // Filtro manual de status
                const pendingInvoices = (invoices || []).filter(i => i.status === "pending");

                const snapshots = pendingInvoices.map(i => ({
                  invoiceId: i.id,
                  customerId: undefined as any,
                  amount: Number(i.amount || 0),
                  dueDate: i.due_date ? new Date(i.due_date + "T00:00:00") : now
                }));

                const resFinance = overdueInvoiceDetector.detect(snapshots, { tenantId, now });
                resFinance.emit.forEach(evt => {
                  bellaEventEngine.emit(evt);
                  results.finance.emitted++;
                });
                results.finance.processed += snapshots.length;

              } catch (err: any) {
                results.errors.push(`Finance Error (${tenantId}): ${err.message}`);
              }

              // --- EXECUÇÃO DUPLICATAS ---
              // Reaproveita preview_duplicate_products (já existe desde a
              // ferramenta de limpeza retroativa, 20260801220144) — mesmo
              // agrupamento por nome normalizado usado no aviso da tela de
              // compra (find_products_by_name_key). Aqui roda periodicamente
              // sobre TODO o catálogo, não só nos itens de uma compra nova.
              try {
                const { data: dupGroups, error: dupError } = await supabaseAdmin.rpc(
                  "preview_duplicate_products",
                  { _company_id: tenantId },
                );

                if (dupError) throw dupError;

                const groups: DuplicateProductGroup[] = (dupGroups ?? []).map((g) => {
                  const dups = Array.isArray(g.duplicates) ? (g.duplicates as { name?: string }[]) : [];
                  return {
                    nameKey: g.name_key,
                    keeperId: g.keeper_id,
                    keeperName: g.keeper_name,
                    duplicateCount: dups.length,
                    duplicateNames: dups.map((d) => d.name ?? "?"),
                  };
                });

                const resDup = possibleDuplicateProductDetector.detect(groups, { tenantId, now });
                resDup.emit.forEach((evt) => {
                  bellaEventEngine.emit(evt);
                  results.duplicates.emitted++;
                });
                results.duplicates.processed += groups.length;
              } catch (err: any) {
                results.errors.push(`Duplicates Error (${tenantId}): ${err.message}`);
              }
            }

            return Response.json({ ok: true, results });
          } catch (err: any) {
            console.error("[bella-detectors] Fatal error:", err);
            return Response.json({ ok: false, error: err.message }, { status: 500 });
          }
        });
      },
    },
  },
});
