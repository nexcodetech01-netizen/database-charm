import { supabase } from "@/integrations/supabase/client";
import { printHtmlDocument } from "@/features/printing/lib/printer";
import { buildVoucherHtml, type VoucherData } from "./voucher";

/** Imprime o vale-troca; busca o nome da loja e da cliente. */
export async function printStoreCreditVoucher(
  input: Omit<VoucherData, "customerName" | "companyName"> & {
    companyId: string;
    customerId: string;
  },
) {
  const [{ data: company }, { data: customer }] = await Promise.all([
    supabase.from("companies").select("name, trade_name").eq("id", input.companyId).maybeSingle(),
    supabase.from("customers").select("name").eq("id", input.customerId).maybeSingle(),
  ]);
  const c = company as { name?: string | null; trade_name?: string | null } | null;
  await printHtmlDocument(
    buildVoucherHtml({
      ...input,
      companyName: c?.trade_name || c?.name || "",
      customerName: (customer as { name?: string } | null)?.name ?? "Cliente",
    }),
  );
}
