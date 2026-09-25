import { describe, expect, it } from "vitest";
import {
  isMLRefreshAuthorizationError,
  MLTokenRefreshError,
} from "../mercadolivre.server";

describe("Mercado Livre — classificação de falhas no refresh", () => {
  it.each([401, 403])("trata HTTP %s como autorização expirada", (status) => {
    const error = new MLTokenRefreshError({ status, body: "unauthorized" });
    expect(isMLRefreshAuthorizationError(error)).toBe(true);
  });

  it("trata apenas invalid_grant no HTTP 400 como autorização expirada", () => {
    const expired = new MLTokenRefreshError({
      status: 400,
      body: JSON.stringify({ error: "invalid_grant" }),
    });
    const temporary = new MLTokenRefreshError({
      status: 400,
      body: JSON.stringify({ error: "temporarily_unavailable" }),
    });

    expect(isMLRefreshAuthorizationError(expired)).toBe(true);
    expect(isMLRefreshAuthorizationError(temporary)).toBe(false);
  });

  it.each([429, 500, 503])("preserva a integração no HTTP %s", (status) => {
    const error = new MLTokenRefreshError({ status, body: "temporary failure" });
    expect(isMLRefreshAuthorizationError(error)).toBe(false);
  });
});