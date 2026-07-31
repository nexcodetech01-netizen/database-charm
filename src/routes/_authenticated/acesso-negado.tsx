import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout";

/**
 * Fallback seguro para o guard `requirePermission`.
 *
 * IMPORTANTE: esta rota NÃO deve receber `requirePermission`.
 * Ela é o destino para onde o guard redireciona quando o usuário
 * não possui a permissão exigida — se ela mesma exigisse permissão,
 * criaria loop infinito de redirect.
 */
export const Route = createFileRoute("/_authenticated/acesso-negado")({
  component: AccessDeniedPage,
  head: () => ({
    meta: [
      { title: "Acesso negado · NexOS" },
      { name: "description", content: "Você não possui permissão para acessar esta área." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AccessDeniedPage() {
  return (
    <PageLayout
      icon={ShieldAlert}
      title="Acesso negado"
      description="Você não possui permissão para acessar esta área do NexOS."
    >
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Se você acredita que deveria ter acesso, peça ao administrador da
          empresa para revisar suas permissões em Configurações → Usuários.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/bella">Ir para Bella</Link>
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
