/**
 * WhatsApp company-level configuration — server functions.
 *
 * Grava/lê o Phone Number ID da Meta (WhatsApp Cloud API) por empresa.
 * A unicidade é garantida por índice único parcial na coluna.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";

export interface CompanyWhatsAppConfig {
  companyId: string;
  companyName: string;
  whatsappPhoneNumberId: string | null;
}

export const getCompanyWhatsAppConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyWhatsAppConfig | null> => {
    const { data, error } = await context.supabase
      .from("companies")
      .select("id, name, whatsapp_phone_number_id")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      companyId: data.id as string,
      companyName: (data.name as string) ?? "",
      whatsappPhoneNumberId:
        (data as { whatsapp_phone_number_id?: string | null })
          .whatsapp_phone_number_id ?? null,
    };
  });

export const setCompanyWhatsAppPhoneNumberId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumberId: string | null }) => {
    const raw = (input.phoneNumberId ?? "").trim();
    if (raw && !/^\d{6,32}$/.test(raw)) {
      throw new Error(
        "Phone Number ID inválido — deve conter apenas dígitos (6 a 32).",
      );
    }
    return { phoneNumberId: raw === "" ? null : raw };
  })
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "settings.update", {
      action: "settings.whatsapp.config",
      module: "settings",
    });
    // Resolve a empresa do usuário autenticado.
    const { data: company, error: selErr } = await context.supabase
      .from("companies")
      .select("id")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!company?.id) throw new Error("Empresa não encontrada.");

    // Verifica conflito de unicidade quando um valor é definido.
    if (data.phoneNumberId) {
      const { data: existing } = await context.supabase
        .from("companies")
        .select("id")
        .eq("whatsapp_phone_number_id", data.phoneNumberId)
        .neq("id", company.id as string)
        .limit(1);
      if (Array.isArray(existing) && existing.length > 0) {
        throw new Error(
          "Este Phone Number ID já está em uso por outra empresa.",
        );
      }
    }

    const { error: updErr } = await context.supabase
      .from("companies")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ whatsapp_phone_number_id: data.phoneNumberId } as any)
      .eq("id", company.id as string);
    if (updErr) {
      // Tratamento amigável do índice único.
      if (
        String(updErr.message ?? "").toLowerCase().includes("duplicate") ||
        String((updErr as { code?: string }).code ?? "") === "23505"
      ) {
        throw new Error(
          "Este Phone Number ID já está em uso por outra empresa.",
        );
      }
      throw new Error(updErr.message);
    }

    return {
      companyId: company.id as string,
      whatsappPhoneNumberId: data.phoneNumberId,
    };
  });
