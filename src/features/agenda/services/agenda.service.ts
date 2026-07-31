import { supabase } from "@/integrations/supabase/client";
import type {
  Appointment,
  AppointmentEvent,
  AppointmentFilters,
  AppointmentInsert,
  AppointmentUpdate,
} from "../types";

export const agendaService = {
  async listRange(companyId: string, filters: AppointmentFilters) {
    let q = supabase
      .from("appointments")
      .select("*")
      .eq("company_id", companyId)
      .gte("starts_at", filters.from)
      .lte("starts_at", filters.to)
      .order("starts_at", { ascending: true });

    if (filters.status) q = q.eq("status", filters.status);
    if (filters.type) q = q.eq("type", filters.type);
    if (filters.priority) q = q.eq("priority", filters.priority);
    if (filters.customerId) q = q.eq("customer_id", filters.customerId);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Appointment[];
  },

  async metrics(companyId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await supabase
      .from("appointments")
      .select("id,status,starts_at,ends_at,completed_at")
      .eq("company_id", companyId);
    if (error) throw error;
    const rows = data ?? [];

    return {
      today: rows.filter(
        (r) =>
          r.starts_at >= startOfToday &&
          r.starts_at <= endOfToday &&
          r.status !== "cancelado",
      ).length,
      next7: rows.filter(
        (r) =>
          r.starts_at >= now.toISOString() &&
          r.starts_at <= in7 &&
          r.status !== "cancelado",
      ).length,
      overdue: rows.filter(
        (r) =>
          r.ends_at < now.toISOString() &&
          r.status !== "concluido" &&
          r.status !== "cancelado",
      ).length,
      completedThisMonth: rows.filter(
        (r) => r.status === "concluido" && (r.completed_at ?? r.ends_at) >= startOfMonth,
      ).length,
    };
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as Appointment | null;
  },

  async create(input: AppointmentInsert) {
    const { data, error } = await supabase
      .from("appointments")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Appointment;
  },

  async update(id: string, input: AppointmentUpdate) {
    const patch: AppointmentUpdate = { ...input };
    if (input.status === "concluido") patch.completed_at = new Date().toISOString();
    if (input.status === "cancelado") patch.cancelled_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Appointment;
  },

  async remove(id: string) {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) throw error;
  },

  async listEvents(appointmentId: string) {
    const { data, error } = await supabase
      .from("appointment_events")
      .select("*")
      .eq("appointment_id", appointmentId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as AppointmentEvent[];
  },
};
