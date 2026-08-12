import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import { buildXmlFileName, buildDanfeFileName } from "../lib/xml-file";

export class XmlService {
  private readonly docsRepo: DocumentsRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string
  ) {
    this.docsRepo = new DocumentsRepository(this.supabase);
  }

  async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    return this.docsRepo.createArtifactSignedUrl(path, expiresIn);
  }

  async getDownloadName(documentId: string, kind: "xml" | "danfe"): Promise<string> {
    const doc = await this.docsRepo.findById(this.companyId, documentId);
    if (!doc) throw new Error("Documento não encontrado.");
    
    const naming = {
      number: doc.number,
      series: doc.series,
      accessKey: doc.accessKey
    };

    return kind === "xml" ? buildXmlFileName(naming) : buildDanfeFileName(naming);
  }

  async exportBatch(from: string, to: string): Promise<{ name: string; contentBase64: string }[]> {
    const rows = await this.docsRepo.listXmlPaths(this.companyId, from, to);

    if (rows.length === 0) {
      throw new Error("Nenhum XML encontrado no período selecionado.");
    }

    const files: { name: string; contentBase64: string }[] = [];

    for (const row of rows) {
      const path = row.xml_authorized_path || row.xml_cancellation_path;
      if (!path) continue;

      try {
        const buffer = await this.docsRepo.downloadXmlArtifact(path);
        if (!buffer) continue;

        const base64 = Buffer.from(buffer).toString("base64");
        const fileName = `${row.access_key || row.number || "nota"}.xml`;
        files.push({ name: fileName, contentBase64: base64 });
      } catch (err) {
        console.error(`Falha ao baixar XML: ${path}`, err);
      }
    }

    if (files.length === 0) {
      throw new Error("Nenhum arquivo XML pôde ser baixado.");
    }

    return files;
  }
}


