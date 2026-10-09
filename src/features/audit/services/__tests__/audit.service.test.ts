import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { auditService } from "../audit.service";

describe("audit authorization", () => {
  beforeEach(() => rpc.mockReset());

  it("grants visibility only when can_view_audit returns true for the company", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await auditService.canView("company-a")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("can_view_audit", { _company_id: "company-a" });
  });

  it("denies visibility on permission lookup failure", async () => {
    rpc.mockResolvedValue({ data: true, error: { message: "Denied" } });
    expect(await auditService.canView("company-a")).toBe(false);
  });

  it("does not treat a truthy nonboolean result as permission", async () => {
    rpc.mockResolvedValue({ data: "true", error: null });
    expect(await auditService.canView("company-a")).toBe(false);
  });
});