import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { requirePermission } from "../require-permission";

vi.mock("../../lib/fetch-permissions", () => ({
  fetchUserPermissions: vi.fn(),
  permissionsQueryKey: (userId: string) => ["permissions", userId],
}));

describe("history access", () => {
  it("allows audit.view for a non-owner", async () => {
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue({
      isOwner: false,
      permissions: new Set(["audit.view"]),
    });
    await expect(requirePermission("audit.view")({
      context: { queryClient, user: { id: "reader" }, company: { id: "company-a", owner_id: "owner" } },
      location: { pathname: "/historico" },
    })).resolves.toBeUndefined();
  });

  it("denies history access when only finance.view is granted", async () => {
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue({
      isOwner: false,
      permissions: new Set(["finance.view"]),
    });
    await expect(requirePermission("audit.view")({
      context: { queryClient, user: { id: "reader" }, company: { id: "company-a", owner_id: "owner" } },
      location: { pathname: "/historico" },
    })).rejects.toMatchObject({ options: { to: "/acesso-negado" } });
  });
});