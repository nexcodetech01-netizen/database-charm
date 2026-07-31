/**
 * Parser client-side do certificado A1 (.pfx / .p12) usando node-forge.
 *
 * Roda inteiramente no navegador. A senha nunca é enviada ao servidor
 * neste passo — apenas testamos localmente se o PKCS#12 abre. O `.pfx`
 * em si vai por upload ao Storage (bucket privado) via server function.
 */
import type forge from "node-forge";

type Forge = typeof import("node-forge");

export type PfxMetadata = {
  subjectName: string;
  subjectCnpj: string | null;
  issuerName: string;
  validFrom: string; // ISO
  validTo: string;   // ISO
  serialNumber: string;
  thumbprint: string; // SHA-1 hex uppercase
};

export type PfxParseError =
  | { kind: "invalid-password" }
  | { kind: "invalid-file"; message: string };

function toArrayBufferBase64(f: Forge, base64: string): forge.util.ByteStringBuffer {
  const bin = atob(base64);
  return f.util.createBuffer(bin, "raw");
}

/** Extrai CN, O, OU legíveis do subject/issuer do X.509. */
function joinDn(attrs: forge.pki.CertificateField[]): string {
  const cn = attrs.find((a) => a.name === "commonName")?.value as string | undefined;
  const o = attrs.find((a) => a.name === "organizationName")?.value as string | undefined;
  if (cn && o) return `${cn} · ${o}`;
  return cn ?? o ?? "";
}

/** Tenta extrair CNPJ (14 dígitos) do CN "NOME:CNPJ" ou de qualquer atributo. */
function extractCnpj(cert: forge.pki.Certificate): string | null {
  const cn = cert.subject.attributes.find((a) => a.name === "commonName")?.value as string | undefined;
  if (cn) {
    const m = cn.match(/(\d{14})/);
    if (m) return m[1];
  }
  // Alguns emissores colocam em SAN otherName. Fallback: procurar em todos os shortNames.
  for (const attr of cert.subject.attributes) {
    if (typeof attr.value === "string") {
      const m = attr.value.match(/(\d{14})/);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * Abre o PKCS#12 e extrai metadados do primeiro certificado do titular.
 * Retorna null se a senha estiver errada; lança em erros de formato.
 */
export async function parsePfx(
  fileBase64: string,
  password: string,
): Promise<PfxMetadata | PfxParseError> {
  const forge: Forge = (await import("node-forge")).default as unknown as Forge;
  let p12: import("node-forge").pkcs12.Pkcs12Pfx;
  try {
    const buffer = toArrayBufferBase64(forge, fileBase64);
    const asn1 = forge.asn1.fromDer(buffer);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // node-forge lança "PKCS#12 MAC could not be verified" quando a senha bate errado.
    if (/mac|password|wrong/i.test(message)) {
      return { kind: "invalid-password" };
    }
    return { kind: "invalid-file", message };
  }

  // Procurar um certBag contendo o certificado do titular.
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = bags[forge.pki.oids.certBag] ?? [];
  if (certs.length === 0) {
    return { kind: "invalid-file", message: "PFX não contém certificado do titular." };
  }

  // O titular geralmente é o primeiro cert não-CA. Fallback: o primeiro.
  const cert =
    certs.find((b) => b.cert && !b.cert.isIssuer(b.cert))?.cert ?? certs[0]?.cert;
  if (!cert) {
    return { kind: "invalid-file", message: "Certificado inválido dentro do PFX." };
  }

  // Thumbprint SHA-1 do DER do certificado (padrão SEFAZ / Windows).
  const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md = forge.md.sha1.create();
  md.update(derBytes);
  const thumbprint = md.digest().toHex().toUpperCase().match(/.{2}/g)!.join(":");

  return {
    subjectName: joinDn(cert.subject.attributes) || "Certificado A1",
    subjectCnpj: extractCnpj(cert),
    issuerName: joinDn(cert.issuer.attributes) || "Autoridade certificadora",
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
    serialNumber: cert.serialNumber.toUpperCase(),
    thumbprint,
  };
}

export function isPfxMetadata(v: PfxMetadata | PfxParseError): v is PfxMetadata {
  return "subjectName" in v;
}
