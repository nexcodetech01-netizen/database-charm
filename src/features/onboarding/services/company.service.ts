import { supabase } from "@/integrations/supabase/client";

export interface CompanyInput {
  name: string;
  trade_name?: string | null;
  cnpj?: string | null;
  segment?: string | null;
  size?: string | null;
}

export const companyService = {
  async getCurrentUserCompany(userId: string) {
    // 1) Invited members: resolve via profiles.current_company_id (set by
    //    accept_company_invite RPC) or via user_roles membership.
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_company_id")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.current_company_id) {
      const { data: byProfile } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.current_company_id)
        .maybeSingle();
      if (byProfile) return byProfile;
      // RLS on `companies` may hide the row from non-owner members. The
      // profile pointer already proves membership, so return a minimal
      // object so the auth guard doesn't send invited users to /onboarding.
      return { id: profile.current_company_id } as any;
    }

    // 2) Membership fallback (user_roles) — first company the user belongs to.
    const { data: membership } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userId)
      .not("company_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (membership?.company_id) {
      const { data: byMembership } = await supabase
        .from("companies")
        .select("*")
        .eq("id", membership.company_id)
        .maybeSingle();
      if (byMembership) return byMembership;
      return { id: membership.company_id } as any;
    }

    // 3) Owner fallback (original behavior).
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },


  async saveCompany(userId: string, input: CompanyInput) {
    // Se o usuário já pertence a uma empresa (owner OU convidado via
    // profiles.current_company_id / user_roles), fazemos UPDATE em vez de
    // criar uma nova — assim sócios que compartilham o mesmo company_id
    // veem os dados já preenchidos e o onboarding não se repete.
    const existing = await this.getCurrentUserCompany(userId);

    if (existing?.id) {
      const { data, error } = await supabase
        .from("companies")
        .update(input)
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;

      await supabase
        .from("profiles")
        .upsert({
          id: userId,
          current_company_id: existing.id,
          onboarded_at: new Date().toISOString(),
        });

      return data ?? existing;
    }

    const { data, error } = await supabase
      .from("companies")
      .insert({ ...input, owner_id: userId })
      .select()
      .single();
    if (error) throw error;

    await supabase
      .from("profiles")
      .upsert({
        id: userId,
        current_company_id: data.id,
        onboarded_at: new Date().toISOString(),
      });

    return data;
  },

  /** Alias retrocompatível — prefira `saveCompany`. */
  async createCompany(userId: string, input: CompanyInput) {
    return this.saveCompany(userId, input);
  },
};

