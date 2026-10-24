/**
 * Bug 2026-10-24: em /comercial/inbox-whatsapp, "Comercial" era link para
 * /comercial — página inexistente (404).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => "/comercial/inbox-whatsapp",
  useRouter: () => ({
    routesByPath: { "/dashboard": {}, "/comercial/inbox-whatsapp": {}, "/vendas": {} },
  }),
}));

import { BreadcrumbNav } from "../breadcrumb-nav";

describe("BreadcrumbNav", () => {
  it("trecho sem página própria não vira link (sem 404)", () => {
    render(<BreadcrumbNav />);
    const comercial = screen.getByText("Comercial");
    expect(comercial.closest("a")).toBeNull();
    expect(screen.getByText("Inbox WhatsApp")).toBeTruthy();
  });
});
