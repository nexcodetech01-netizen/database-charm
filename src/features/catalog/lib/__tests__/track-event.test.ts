import { describe, expect, it } from "vitest";
import { parseTrackInput } from "../track-event.server";

const base = { slug: "verao", visitor_id: "abcdef123456" };
const pid = "0f8b2c1e-3a4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("parseTrackInput", () => {
  it("aceita visita de coleção", () => {
    expect(parseTrackInput({ ...base, event: "collection_view" })?.event).toBe("collection_view");
  });
  it("peça vista exige id de produto válido", () => {
    expect(parseTrackInput({ ...base, event: "product_view" })).toBeNull();
    expect(parseTrackInput({ ...base, event: "product_view", product_id: "x" })).toBeNull();
    expect(parseTrackInput({ ...base, event: "product_view", product_id: pid })?.productId).toBe(pid);
  });
  it("clique no WhatsApp pode vir sem produto (botão da coleção)", () => {
    expect(parseTrackInput({ ...base, event: "whatsapp_click" })?.productId).toBeNull();
  });
  it("recusa evento desconhecido e visitante inválido", () => {
    expect(parseTrackInput({ ...base, event: "purchase" })).toBeNull();
    expect(parseTrackInput({ slug: "verao", event: "collection_view", visitor_id: "x" })).toBeNull();
  });
});
