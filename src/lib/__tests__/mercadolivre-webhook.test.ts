import { describe, expect, it } from "vitest";
import { validateMLNotification } from "../mercadolivre-webhook.server";

describe("validateMLNotification", () => {
  it("aceita uma notificação orders_v2 válida", () => {
    expect(
      validateMLNotification({
        topic: "orders_v2",
        resource: "/orders/2000009999",
        user_id: 123456,
        application_id: 987654,
      }),
    ).toEqual({
      topic: "orders_v2",
      resource: "/orders/2000009999",
      userId: "123456",
      applicationId: "987654",
    });
  });

  it("rejeita tópico fora da allow-list", () => {
    expect(
      validateMLNotification({
        topic: "orders_v3",
        resource: "/orders/1",
        user_id: 1,
      }),
    ).toBeNull();
  });

  it("rejeita resource fora do padrão do tópico (anti-SSRF)", () => {
    for (const resource of [
      "https://evil.example.com/orders/1",
      "/orders/1/../../users/me",
      "/users/me",
      "//evil.example.com/orders/1",
      "/orders/abc",
    ]) {
      expect(validateMLNotification({ topic: "orders_v2", resource, user_id: 1 })).toBeNull();
    }
  });

  it("rejeita payload sem user_id ou com user_id inválido", () => {
    expect(validateMLNotification({ topic: "orders_v2", resource: "/orders/1" })).toBeNull();
    expect(
      validateMLNotification({
        topic: "orders_v2",
        resource: "/orders/1",
        user_id: "abc",
      }),
    ).toBeNull();
  });

  it("aceita outros tópicos conhecidos com resource compatível", () => {
    expect(
      validateMLNotification({
        topic: "items",
        resource: "/items/MLB123456",
        user_id: 7,
      })?.topic,
    ).toBe("items");
  });
});
