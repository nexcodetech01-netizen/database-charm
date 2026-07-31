import { digits } from "./masks";

export interface CepAddress {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
}

const cache = new Map<string, CepAddress | null>();

/**
 * Consulta ViaCEP com cache em memória.
 * Retorna null quando o CEP é inválido, não existe ou a rede falha.
 */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const d = digits(cep);
  if (d.length !== 8) return null;
  if (cache.has(d)) return cache.get(d) ?? null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      cache.set(d, null);
      return null;
    }
    const raw = (await res.json()) as {
      erro?: boolean;
      cep?: string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
      complemento?: string;
    };
    if (raw.erro) {
      cache.set(d, null);
      return null;
    }
    const address: CepAddress = {
      cep: raw.cep ?? d,
      street: raw.logradouro ?? "",
      neighborhood: raw.bairro ?? "",
      city: raw.localidade ?? "",
      state: raw.uf ?? "",
      complement: raw.complemento ?? "",
    };
    cache.set(d, address);
    return address;
  } catch {
    return null;
  }
}
