/**
 * Auditoria 4.3 — o webhook processa TODOS os eventos de um POST da Meta,
 * e uma falha isolada vai para a DLQ sem derrubar as demais mensagens.
 */
import { describe, expect, it, vi } from "vitest";
import { extractWhatsAppEvents, whatsAppEventReference } from "../webhook-events";
import { processWhatsAppEvents, reprocessWhatsAppDeadLetter } from "../webhook-processor.server";

const msg = (id: string, from: string, body: string) => ({
  id,
  from,
  timestamp: "1761170000",
  type: "text",
  text: { body },
});

/** POST com 2 entries, 3 changes, 4 mensagens e 2 status. */
const batch = {
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: "PN1" },
            contacts: [
              { wa_id: "5514999990001", profile: { name: "Ana" } },
              { wa_id: "5514999990002", profile: { name: "Bia" } },
            ],
            messages: [
              msg("wamid.1", "5514999990001", "oi"),
              msg("wamid.2", "5514999990002", "quero a bolsa"),
            ],
            statuses: [{ id: "wamid.out1", status: "delivered" }],
          },
        },
        {
          value: {
            metadata: { phone_number_id: "PN1" },
            statuses: [{ id: "wamid.out2", status: "read" }],
          },
        },
      ],
    },
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: "PN2" },
            contacts: [{ wa_id: "5511988880000", profile: { name: "Caio" } }],
            messages: [
              msg("wamid.3", "5511988880000", "tem em preto?"),
              msg("wamid.4", "5511988880000", "e o frete?"),
            ],
          },
        },
      ],
    },
  ],
};

function fakeDb(map: Record<string, string | null>) {
  const lookups: string[] = [];
  return {
    lookups,
    from: () => ({
      select: () => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => {
            lookups.push(value);
            return { data: map[value] ? { id: map[value] } : null };
          },
        }),
      }),
    }),
  };
}

describe("extractWhatsAppEvents", () => {
  it("extrai todas as mensagens e status de todos os entries/changes", () => {
    const events = extractWhatsAppEvents(batch);
    expect(events).toHaveLength(6);
    expect(events.filter((e) => e.msg).map((e) => e.msg!.waMessageId)).toEqual([
      "wamid.1",
      "wamid.2",
      "wamid.3",
      "wamid.4",
    ]);
    expect(events.filter((e) => e.status)).toHaveLength(2);
  });

  it("associa cada mensagem ao contato certo (pelo wa_id)", () => {
    const events = extractWhatsAppEvents(batch);
    expect(events.find((e) => e.msg?.waMessageId === "wamid.2")!.msg!.profileName).toBe("Bia");
    expect(events.find((e) => e.msg?.waMessageId === "wamid.3")!.phoneNumberId).toBe("PN2");
  });

  it("ignora payload inválido sem lançar", () => {
    expect(extractWhatsAppEvents(null)).toEqual([]);
    expect(extractWhatsAppEvents({ entry: "x" })).toEqual([]);
    expect(
      extractWhatsAppEvents({ entry: [{ changes: [{ value: { messages: [{}] } }] }] }),
    ).toEqual([]);
  });

  it("gera referência estável para DLQ", () => {
    const [m, , s] = extractWhatsAppEvents(batch);
    expect(whatsAppEventReference(m)).toBe("wamid.1");
    expect(whatsAppEventReference(s)).toBe("wamid.out1:delivered");
  });
});

describe("processWhatsAppEvents", () => {
  it("processa todos os eventos e consulta a empresa uma vez por número", async () => {
    const db = fakeDb({ PN1: "company-1", PN2: "company-2" });
    const handle = vi.fn().mockResolvedValue(undefined);
    const recordDeadLetter = vi.fn();

    const res = await processWhatsAppEvents(extractWhatsAppEvents(batch), {
      db,
      handle,
      recordDeadLetter,
    });

    expect(res).toEqual({ total: 6, processed: 6, failed: 0, unknownNumber: 0 });
    expect(handle).toHaveBeenCalledTimes(6);
    expect(db.lookups).toEqual(["PN1", "PN2"]);
    expect(recordDeadLetter).not.toHaveBeenCalled();
  });

  it("falha em uma mensagem vai para a DLQ e as demais continuam", async () => {
    const db = fakeDb({ PN1: "company-1", PN2: "company-2" });
    const handle = vi.fn(async ({ msg }: { msg: { waMessageId: string } | null }) => {
      if (msg?.waMessageId === "wamid.2") throw new Error("timeout da IA");
    });
    const recordDeadLetter = vi.fn().mockResolvedValue(undefined);

    const res = await processWhatsAppEvents(extractWhatsAppEvents(batch), {
      db,
      handle: handle as never,
      recordDeadLetter,
    });

    expect(res.processed).toBe(5);
    expect(res.failed).toBe(1);
    expect(recordDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "whatsapp",
        topic: "message",
        reference: "wamid.2",
        companyId: "company-1",
        errorMessage: "timeout da IA",
      }),
    );
  });

  it("número sem empresa vinculada é ignorado (sem DLQ)", async () => {
    const db = fakeDb({ PN1: "company-1" });
    const handle = vi.fn().mockResolvedValue(undefined);
    const recordDeadLetter = vi.fn();
    const res = await processWhatsAppEvents(extractWhatsAppEvents(batch), {
      db,
      handle,
      recordDeadLetter,
    });
    expect(res.unknownNumber).toBe(2);
    expect(res.processed).toBe(4);
    expect(recordDeadLetter).not.toHaveBeenCalled();
  });
});

describe("reprocessWhatsAppDeadLetter", () => {
  it("reprocessa o evento salvo na DLQ", async () => {
    const db = fakeDb({ PN1: "company-1" });
    const handle = vi.fn().mockResolvedValue(undefined);
    const [event] = extractWhatsAppEvents(batch);
    await reprocessWhatsAppDeadLetter(JSON.parse(JSON.stringify(event)), { db, handle });
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("lança se falhar de novo (o job conta a tentativa)", async () => {
    const db = fakeDb({ PN1: "company-1" });
    const handle = vi.fn().mockRejectedValue(new Error("ainda fora"));
    const [event] = extractWhatsAppEvents(batch);
    await expect(reprocessWhatsAppDeadLetter(event, { db, handle })).rejects.toThrow("ainda fora");
  });

  it("rejeita payload inválido", async () => {
    await expect(reprocessWhatsAppDeadLetter({}, { db: fakeDb({}) })).rejects.toThrow();
  });
});
