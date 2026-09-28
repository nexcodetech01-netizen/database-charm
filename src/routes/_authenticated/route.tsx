import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { companyService } from "@/features/onboarding";
import { AppLayout } from "@/components/layout/app-layout";
import { NextActionProvider } from "@/components/feedback/next-action-provider";
import { PaymentConfirmedListener } from "@/components/feedback/payment-confirmed-listener";
import { NotificationLogPanel } from "@/features/diagnostics/components/notification-log-panel";
import { CommandPalette } from "@/features/command-palette";

type CurrentCompany = Awaited<ReturnType<typeof companyService.getCurrentUserCompany>>;

const currentCompanyKey = (userId: string) => ["auth", "current-company", userId] as const;

/** Após isso, a empresa é revalidada em segundo plano na próxima navegação. */
const COMPANY_STALE_MS = 30_000;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // O beforeLoad roda em TODA navegação (o staleTime de rota só vale para
  // loaders). Por isso ele precisa ser barato: nada de rede no caminho
  // comum — só na primeira carga.
  beforeLoad: async ({ context }) => {
    // getSession lê a sessão salva no aparelho, sem ida ao servidor de
    // autenticação (getUser fazia essa ida a cada clique). A segurança dos
    // dados não depende disto: o banco valida o token em cada consulta (RLS).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw redirect({ to: "/auth" });

    // If the user arrived through an invite, finish that flow before any
    // company/onboarding check — an invited member has no owned company.
    if (typeof window !== "undefined") {
      const pendingToken = window.localStorage.getItem("nexos:pending-invite-token");
      if (pendingToken) {
        throw redirect({ to: "/invite/$token", params: { token: pendingToken } });
      }
    }

    // Empresa: cache no QueryClient. Com cache, a navegação não espera a
    // rede e a revalidação acontece em segundo plano (edições nas
    // configurações da empresa aparecem na navegação seguinte).
    const { queryClient } = context;
    const key = currentCompanyKey(user.id);
    const fetchCompany = () => companyService.getCurrentUserCompany(user.id);

    let company = queryClient.getQueryData<CurrentCompany>(key);
    if (company) {
      void queryClient.prefetchQuery({
        queryKey: key,
        queryFn: fetchCompany,
        staleTime: COMPANY_STALE_MS,
        // Sem observadores esta query seria descartada em 5 min (gcTime
        // padrão) e a navegação voltaria a esperar a rede.
        gcTime: Infinity,
      });
    } else {
      company = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: fetchCompany,
        staleTime: COMPANY_STALE_MS,
        // Sem observadores esta query seria descartada em 5 min (gcTime
        // padrão) e a navegação voltaria a esperar a rede.
        gcTime: Infinity,
      });
    }

    if (!company) {
      // Não guarda "sem empresa": após o onboarding a próxima checagem
      // precisa ir ao banco.
      queryClient.removeQueries({ queryKey: key });
      throw redirect({ to: "/onboarding" });
    }

    return { user, company };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { company } = Route.useRouteContext();
  return (
    <NextActionProvider>
      <PaymentConfirmedListener />
      <AppLayout>
        <Outlet />
        <NotificationLogPanel />
      </AppLayout>
      <CommandPalette companyId={company.id} />
    </NextActionProvider>
  );
}
