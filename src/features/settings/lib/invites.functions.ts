import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import type { Database } from "@/integrations/supabase/types";
import { integrationFetch } from "@/lib/http-client.server";
import { buildRevokeInviteFilter } from "./invite-filters";

const createInviteSchema = z.object({
  name: z.string().trim().min(1).max(120).optional().nullable(),
  email: z.string().trim().toLowerCase().email(),
  roleId: z.string().uuid(),
  origin: z.string().url(),
});

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendInviteEmail(opts: {
  to: string;
  name?: string | null;
  inviterName: string;
  companyName: string;
  inviteUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const senderDomain = process.env.SENDER_DOMAIN;
  if (!apiKey || !senderDomain) {
    return { sent: false, reason: "email_not_configured" };
  }
  try {
    const subject = `${opts.inviterName} convidou você para o ${opts.companyName} no NexOS`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
        <h2 style="margin:0 0 12px">Você foi convidado(a) para o NexOS</h2>
        <p style="margin:0 0 12px">Olá${opts.name ? ` ${opts.name}` : ""},</p>
        <p style="margin:0 0 16px">
          <strong>${opts.inviterName}</strong> convidou você para participar de
          <strong>${opts.companyName}</strong> no NexOS.
        </p>
        <p style="margin:0 0 24px">
          <a href="${opts.inviteUrl}"
             style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;
                    padding:12px 20px;border-radius:8px;font-weight:600">
            Aceitar convite
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:12px;color:#64748B">
          Ou copie e cole este link no navegador:
        </p>
        <p style="margin:0;font-size:12px;color:#64748B;word-break:break-all">${opts.inviteUrl}</p>
        <p style="margin:24px 0 0;font-size:12px;color:#94A3B8">
          O convite expira em 7 dias.
        </p>
      </div>`;
    const res = await integrationFetch(
      "https://email-api.lovable.dev/v1/emails/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: `NexOS <no-reply@${senderDomain}>`,
          to: [opts.to],
          subject,
          html,
        }),
      },
      { integration: "lovable-email", timeoutMs: 15_000 },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error("[invite email] failed", res.status, body);
      return { sent: false, reason: `email_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[invite email] error", err);
    return { sent: false, reason: "email_exception" };
  }
}

/** Owner creates an invite. Returns the invite id + url. */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createInviteSchema>) =>
    createInviteSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    const { companyId } = await requireServerPermission(context, "settings.create", {
      action: "settings.invite.create",
      module: "settings",
    });
    const { supabase, userId } = context;

    // FIX (auditoria 2026-08-14): antes, buscava a empresa de novo aqui só
    // por owner_id, ignorando o companyId já resolvido corretamente acima
    // (que respeita permissão delegada, não só o dono). Um gerente/membro
    // de equipe com a permissão "settings.create" concedida passava na
    // checagem de permissão, mas era barrado aqui mesmo assim, porque não
    // era literalmente o owner_id — contradizendo a permissão que acabara
    // de ser confirmada. Agora usa o companyId já resolvido.
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id, name, owner_id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyErr) throw companyErr;
    if (!company) throw new Error("Empresa não encontrada.");

    const { data: role, error: roleErr } = await supabase
      .from("roles")
      .select("id, name")
      .eq("id", data.roleId)
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (!role) throw new Error("Perfil inválido.");

    // Revoke any prior pending invite for same email + company
    await supabase
      .from("company_invites")
      .update({ status: "revoked" })
      .eq("company_id", company.id)
      .eq("email", data.email)
      .eq("status", "pending");

    const token = randomToken();

    const { data: invite, error: insertErr } = await supabase
      .from("company_invites")
      .insert({
        company_id: company.id,
        email: data.email,
        name: data.name ?? null,
        role_id: data.roleId,
        token,
        invited_by: userId,
      })
      .select("id, token, email, name, expires_at")
      .single();

    if (insertErr) throw insertErr;

    const inviteUrl = `${data.origin.replace(/\/$/, "")}/invite/${token}`;

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const inviterName =
      inviterProfile?.full_name ||
      (context.claims as { email?: string })?.email ||
      "Um administrador";

    const email = await sendInviteEmail({
      to: data.email,
      name: data.name,
      inviterName,
      companyName: company.name ?? "sua empresa",
      inviteUrl,
    });

    return {
      inviteId: invite.id,
      inviteUrl,
      emailSent: email.sent,
      emailReason: email.reason ?? null,
    };
  });

/** List invites for the user's active company. */
export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // FIX (auditoria 2026-08-14): mesmos dois problemas dos outros —
    // buscava a empresa só por owner_id (bloqueando gerentes/membros com
    // permissão real), e não tinha checagem de permissão nenhuma (só
    // "funcionava" por acidente, porque a busca por owner_id retornava
    // vazio pra quem não fosse dono).
    const { companyId } = await requireServerPermission(context, "settings.view", {
      action: "settings.invite.list",
      module: "settings",
    });
    const { supabase } = context;
    const { data, error } = await supabase
      .from("company_invites")
      .select("id, email, name, status, expires_at, created_at, accepted_at, role:roles(id, name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string }) =>
    z.object({ inviteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    const { companyId } = await requireServerPermission(context, "settings.delete", {
      action: "settings.invite.revoke",
      module: "settings",
    });
    const { supabase } = context;
    // FIX (auditoria 2026-08-14): faltava restringir por company_id — a
    // checagem de permissão confirma que o usuário TEM a permissão em SUA
    // empresa, mas sem esse filtro aqui, ele poderia revogar um convite de
    // QUALQUER empresa só sabendo o ID do convite (UUID). Agora a
    // atualização só afeta convites da própria empresa do usuário.
    const filter = buildRevokeInviteFilter(data.inviteId, companyId);
    const { error } = await supabase
      .from("company_invites")
      .update({ status: "revoked" })
      .eq("id", filter.id)
      .eq("company_id", filter.company_id)
      .eq("status", filter.status);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Public: fetch invite metadata by token (safe fields only).
 *
 * IMPORTANT: this server function must NOT require authentication.
 * It is called from `/invite/:token` before the invited user has any session.
 * We deliberately do not attach `requireSupabaseAuth` and we use the
 * service-role admin client (loaded inside the handler) to query the
 * invite exclusively by token — no user context is needed.
 */
export const getInviteByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(10).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabasePublic = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: invite, error } = await supabasePublic.rpc("get_company_invite_by_token", {
      _token: data.token,
    });
    if (error) throw error;
    return z
      .discriminatedUnion("valid", [
        z.object({ valid: z.literal(false), reason: z.string() }),
        z.object({
          valid: z.literal(true),
          email: z.string().email(),
          name: z.string().nullable(),
          companyName: z.string(),
          roleName: z.string(),
        }),
      ])
      .parse(invite);
  });



/** Accept invite: user must be authenticated. */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(10).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("accept_company_invite", {
      _token: data.token,
    });
    if (error) throw error;
    return z.object({ ok: z.literal(true), companyId: z.string().uuid() }).parse(result);
  });
