import type { SupabaseClient } from "@supabase/supabase-js";
import { StatusRepository } from "../repositories/status.repository";
import type { NfeEnvironment } from "../types";

export class StatusService {
  private readonly statusRepo: StatusRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string
  ) {
    this.statusRepo = new StatusRepository(this.supabase);
  }

  async updateHealth(
    environment: NfeEnvironment,
    status: "ok" | "warning" | "error",
    message: string
  ): Promise<void> {
    await this.statusRepo.updateEnvironment(this.companyId, environment, {
      last_health_status: status,
      last_health_message: message,
      last_health_check_at: new Date().toISOString()
    });
  }

  async provision(
    userId: string,
    environment: NfeEnvironment,
    markOnly: boolean
  ): Promise<{ ok: boolean; message: string }> {
    const { provisionProviderCertificateEngine } = await import("../functions/nfe-engine.server");
    return provisionProviderCertificateEngine({
      supabase: this.supabase,
      companyId: this.companyId,
      userId,
      environment,
      markOnly,
    });
  }

  async provisionCertificate(
    environment: NfeEnvironment,
    certificateId: string,
    note?: string
  ): Promise<void> {
    await this.statusRepo.updateEnvironment(this.companyId, environment, {
      provisioned_certificate_id: certificateId,
      provisioned_at: new Date().toISOString(),
      provisioned_note: note || "Certificado atualizado via motor."
    });
  }

  async clearProvisioning(environment?: NfeEnvironment): Promise<void> {
    const patch = {
      provisioned_at: null,
      provisioned_environment: null,
      provisioned_certificate_id: null,
      provisioned_by: null,
      provisioned_note: null,
    };
    if (environment) {
      await this.statusRepo.updateEnvironment(this.companyId, environment, patch);
    } else {
      await this.statusRepo.updateAllEnvironments(this.companyId, patch);
    }
    await this.statusRepo.updateProviderConfig(this.companyId, patch, "company_id");
  }
}


