import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { companyService } from "@/features/onboarding";
import { AppLayout } from "@/components/layout/app-layout";
import { NextActionProvider } from "@/components/feedback/next-action-provider";
import { PaymentConfirmedListener } from "@/components/feedback/payment-confirmed-listener";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Layout persistente: só reavalia auth/company a cada 5 min ou quando
  // o router for invalidado (sign-in/out, mudança de contexto).
  // Sem isto, cada clique no menu dispara supabase.auth.getUser() +
  // consulta de empresa antes de renderizar a próxima rota.
  staleTime: 5 * 60_000,
  shouldReload: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // If the user arrived through an invite, finish that flow before any
    // company/onboarding check — an invited member has no owned company.
    if (typeof window !== "undefined") {
      const pendingToken = window.localStorage.getItem("nexos:pending-invite-token");
      if (pendingToken) {
        throw redirect({ to: "/invite/$token", params: { token: pendingToken } });
      }
    }

    const company = await companyService.getCurrentUserCompany(data.user.id);
    if (!company) throw redirect({ to: "/onboarding" });

    return { user: data.user, company };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <NextActionProvider>
      <PaymentConfirmedListener />
      <AppLayout>
        <Outlet />
      </AppLayout>
    </NextActionProvider>
  );
}
