// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const used = vi.hoisted(() => new Set<string>());
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      delete: () => ({ lt: () => Promise.resolve({ error: null }) }),
      insert: (row: { nonce: string }) => {
        if (used.has(row.nonce)) {
          return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
        }
        used.add(row.nonce);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

import { consumeOAuthNonce } from "../oauth-nonce.server";

describe("consumeOAuthNonce", () => {
  it("aceita o state na primeira vez e recusa a repetição", async () => {
    expect(await consumeOAuthNonce("abc", "u1")).toBe(true);
    expect(await consumeOAuthNonce("abc", "u1")).toBe(false);
    expect(await consumeOAuthNonce("outro", "u1")).toBe(true);
  });
});
