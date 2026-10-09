import { supabase } from "@/integrations/supabase/client";
import { AUDIT_AREAS, type AuditArea, type AuditEntry } from "../lib/describe";

// audit_log ainda não está nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface AuditListFilters {
  companyId: string;
  area?: AuditArea | "";
  actorId?: string | "";
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export const auditService = {
  async canView(companyId: string): Promise<boolean> {
    const { data, error } = await db.rpc("can_view_audit", { _company_id: companyId });
    if (error) return false;
    return data === true;
  },

  async list(f: AuditListFilters): Promise<{ rows: AuditEntry[]; total: number }> {
    let q = db
      .from("audit_log")
      .select("*", { count: "exact" })
      .eq("company_id", f.companyId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (f.area) q = q.in("table_name", [...AUDIT_AREAS[f.area].tables]);
    if (f.actorId === "none") q = q.is("actor_id", null);
    else if (f.actorId) q = q.eq("actor_id", f.actorId);
    if (f.from) q = q.gte("created_at", `${f.from}T00:00:00-03:00`);
    if (f.to) q = q.lte("created_at", `${f.to}T23:59:59.999-03:00`);
    const start = (f.page - 1) * f.pageSize;
    q = q.range(start, start + f.pageSize - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: (data ?? []) as AuditEntry[], total: count ?? 0 };
  },

  async forRecord(table: string, recordId: string): Promise<AuditEntry[]> {
    const { data, error } = await db
      .from("audit_log")
      .select("*")
      .or(`and(table_name.eq.${table},record_id.eq.${recordId}),and(parent_table.eq.${table},parent_id.eq.${recordId})`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as AuditEntry[];
  },

  async actors(companyId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await db
      .from("audit_log")
      .select("actor_id, actor_name")
      .eq("company_id", companyId)
      .not("actor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return [];
    const seen = new Map<string, string>();
    for (const r of (data ?? []) as { actor_id: string; actor_name: string | null }[]) {
      if (!seen.has(r.actor_id)) seen.set(r.actor_id, r.actor_name ?? "Usuário");
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  },
};
