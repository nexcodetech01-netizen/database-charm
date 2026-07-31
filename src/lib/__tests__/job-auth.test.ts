import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeJobRequest, extractJobCredential, timingSafeEqual } from "../job-auth.server";

const SECRET = "s".repeat(40);
const PUBLISHABLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.public.anon";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/public/jobs/x", { method: "POST", headers });
}

describe("timingSafeEqual", () => {
  it("compara valores iguais e diferentes", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

describe("extractJobCredential", () => {
  it("lê Bearer e x-cron-secret", () => {
    expect(extractJobCredential(req({ authorization: `Bearer ${SECRET}` }))).toBe(SECRET);
    expect(extractJobCredential(req({ "x-cron-secret": SECRET }))).toBe(SECRET);
    expect(extractJobCredential(req())).toBe("");
  });

  it("ignora o header apikey (chave pública)", () => {
    expect(extractJobCredential(req({ apikey: PUBLISHABLE }))).toBe("");
  });
});

describe("authorizeJobRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("503 quando o segredo não está configurado", () => {
    vi.stubEnv("CRON_JOB_SECRET", "");
    const res = authorizeJobRequest(req({ authorization: `Bearer ${SECRET}` }));
    expect(res?.status).toBe(503);
  });

  it("503 quando o segredo é fraco", () => {
    const res = authorizeJobRequest(req({ authorization: "Bearer short" }), { secret: "short" });
    expect(res?.status).toBe(503);
  });

  it("401 sem credencial", () => {
    expect(authorizeJobRequest(req(), { secret: SECRET })?.status).toBe(401);
  });

  it("401 para a chave publishable do Supabase", () => {
    expect(authorizeJobRequest(req({ apikey: PUBLISHABLE }), { secret: SECRET })?.status).toBe(401);
    expect(
      authorizeJobRequest(req({ authorization: `Bearer ${PUBLISHABLE}` }), { secret: SECRET })
        ?.status,
    ).toBe(401);
  });

  it("autoriza somente o segredo dedicado", () => {
    expect(
      authorizeJobRequest(req({ authorization: `Bearer ${SECRET}` }), { secret: SECRET }),
    ).toBe(null);
    expect(authorizeJobRequest(req({ "x-cron-secret": SECRET }), { secret: SECRET })).toBe(null);
  });
});
