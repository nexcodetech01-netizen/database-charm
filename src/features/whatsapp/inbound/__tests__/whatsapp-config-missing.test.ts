/**
 * Envio WhatsApp sem credenciais configuradas.
 *
 * Regra: faltar `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` NÃO é
 * falha de envio — é configuração pendente. Os helpers devolvem um aviso
 * amigável e nunca lançam, para que o chat não trave.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WHATSAPP_NOT_CONFIGURED,
  WHATSAPP_PENDING_MESSAGE,
  getWhatsAppCredentials,
  sendWhatsAppImage,
  sendWhatsAppTemplateRaw,
  sendWhatsAppText,
} from "@/lib/whatsapp.server";

const ENV_KEYS = ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN"] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  vi.restoreAllMocks();
});

describe("whatsapp · configuração pendente", () => {
  it("lista os secrets ausentes sem lançar", () => {
    const creds = getWhatsAppCredentials();
    expect(creds.configured).toBe(false);
    expect(creds.missing).toEqual([
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_ACCESS_TOKEN",
    ]);
  });

  it("reporta apenas o secret que falta", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    const creds = getWhatsAppCredentials();
    expect(creds.configured).toBe(false);
    expect(creds.missing).toEqual(["WHATSAPP_ACCESS_TOKEN"]);
  });

  it("reconhece a integração configurada", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    expect(getWhatsAppCredentials().configured).toBe(true);
  });

  it("texto: devolve aviso amigável em vez de erro técnico", async () => {
    const res = await sendWhatsAppText({ to: "11988887777", text: "Olá" });
    expect(res.ok).toBe(false);
    expect(res.code).toBe(WHATSAPP_NOT_CONFIGURED);
    expect(res.error).toBe(WHATSAPP_PENDING_MESSAGE);
    expect(res.error).toContain("Configuração do WhatsApp pendente");
    expect(res.missing).toContain("WHATSAPP_ACCESS_TOKEN");
    expect(res.waMessageId).toBeNull();
  });

  it("imagem: mesmo contrato amigável", async () => {
    const res = await sendWhatsAppImage({
      to: "11988887777",
      imageUrl: "https://exemplo.com/a.jpg",
    });
    expect(res.code).toBe(WHATSAPP_NOT_CONFIGURED);
    expect(res.error).toBe(WHATSAPP_PENDING_MESSAGE);
  });

  it("template: mesmo contrato amigável", async () => {
    const res = await sendWhatsAppTemplateRaw({
      to: "11988887777",
      templateName: "cobranca_pix",
    });
    expect(res.code).toBe(WHATSAPP_NOT_CONFIGURED);
    expect(res.error).toBe(WHATSAPP_PENDING_MESSAGE);
  });

  it("não faz nenhuma chamada de rede quando falta configuração", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await sendWhatsAppText({ to: "11988887777", text: "Olá" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("telefone inválido continua sendo erro de validação", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    const res = await sendWhatsAppText({ to: "", text: "Olá" });
    expect(res.ok).toBe(false);
    expect(res.code).toBeUndefined();
    expect(res.error).toBe("Telefone inválido.");
  });
});
