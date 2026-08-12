import type { SupabaseClient } from "@supabase/supabase-js";
import { CertificateRepository } from "../repositories/certificate.repository";
import type { FiscalCertificateSummary } from "../types";

export class CertificateService {
  private readonly certRepo: CertificateRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string
  ) {
    this.certRepo = new CertificateRepository(this.supabase);
  }

  async getActive(): Promise<FiscalCertificateSummary | null> {
    return this.certRepo.findActive(this.companyId);
  }

  async validateExpiry(certificate: FiscalCertificateSummary): Promise<void> {
    if (!certificate.validTo) return;
    const expiry = new Date(certificate.validTo);
    if (expiry < new Date()) {
      throw new Error(`Certificado ${certificate.alias} expirou em ${expiry.toLocaleDateString()}.`);
    }
  }

  async list(): Promise<FiscalCertificateSummary[]> {
    return this.certRepo.list(this.companyId);
  }

  async delete(certificateId: string): Promise<void> {
    await this.certRepo.delete(this.companyId, certificateId);
  }

  async activate(certificateId: string): Promise<void> {
    await this.certRepo.activate(this.companyId, certificateId);
  }
}


