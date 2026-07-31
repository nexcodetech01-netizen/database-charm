import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyForm, companyService } from "@/features/onboarding";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Invited users must complete the invite acceptance instead of creating
    // a new company — preserve the invite context across the auth roundtrip.
    if (typeof window !== "undefined") {
      const pendingToken = window.localStorage.getItem("nexos:pending-invite-token");
      if (pendingToken) {
        throw redirect({ to: "/invite/$token", params: { token: pendingToken } });
      }
    }

    const existing = await companyService.getCurrentUserCompany(data.user.id);
    if (existing) throw redirect({ to: "/dashboard" });

    return { user: data.user };
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">NexOS</span>
        </div>

        <div className="mb-8 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Etapa 1 de 1
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Vamos configurar sua empresa
          </h1>
          <p className="text-sm text-muted-foreground">
            Precisamos de alguns dados básicos para preparar seu workspace. Você poderá ajustar tudo depois.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <CompanyForm
            userId={user.id}
            onDone={async () => {
              await router.invalidate();
              navigate({ to: "/dashboard" });
            }}
          />
        </div>
      </div>
    </div>
  );
}
