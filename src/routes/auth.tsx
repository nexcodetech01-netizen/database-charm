import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { NexosLogo } from "@/components/brand/nexos-logo";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignInForm, SignUpForm, ForgotPasswordForm } from "@/features/auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      if (typeof window !== "undefined") {
        const pendingToken = window.localStorage.getItem("nexos:pending-invite-token");
        if (pendingToken) {
          throw redirect({ to: "/invite/$token", params: { token: pendingToken } });
        }
      }
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

type Mode = "tabs" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("tabs");

  const goToApp = () => navigate({ to: "/dashboard" });

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden bg-gradient-to-br from-primary via-primary to-blue-700 p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <NexosLogo size={40} className="ring-white/20" />
          <span className="text-lg font-semibold">NexOS</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Gestão empresarial <br /> com clareza e velocidade.
          </h1>
          <p className="max-w-md text-sm text-white/70">
            Tudo o que sua PME precisa em uma única plataforma: vendas, estoque, finanças e mais — desenhado para o dia a dia real.
          </p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} NexOS · Feito no Brasil</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <div className="flex items-center gap-2">
              <NexosLogo size={32} />
              <span className="text-sm font-semibold">NexOS</span>
            </div>
          </div>

          {mode === "forgot" ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Recuperar senha</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe seu email para receber o link de recuperação.
                </p>
              </div>
              <ForgotPasswordForm onBack={() => setMode("tabs")} />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Bem-vindo(a) ao NexOS</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entre ou crie sua conta para começar.
                </p>
              </div>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>
                <TabsContent value="signin" className="mt-6">
                  <SignInForm onSuccess={goToApp} onForgotPassword={() => setMode("forgot")} />
                </TabsContent>
                <TabsContent value="signup" className="mt-6">
                  <SignUpForm onSuccess={goToApp} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
