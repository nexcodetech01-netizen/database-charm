import { Link } from "@tanstack/react-router";
import { Users, Shield, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout";
import { useRole, usePermissions } from "@/features/rbac";
import { useAuth } from "@/providers/auth-provider";
import { InviteUserDialog, PendingInvitesList } from "./invite-user";

export function UsuariosSection() {
  const { user } = useAuth();
  const { roles, primaryRole } = useRole();
  const { permissions, isOwner } = usePermissions();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Usuários e acessos</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gestão de perfis, papéis e permissões (RBAC).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info("Envie um convite pelo botão 'Novo usuário' para atribuir permissões.")
              }
            >
              <Shield className="mr-1.5 h-3.5 w-3.5" /> Permissões
            </Button>
            <InviteUserDialog />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PendingInvitesList />
          <div className="rounded-lg border">
            <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div className="col-span-5">Nome</div>
              <div className="col-span-3">Perfil</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Último acesso</div>
            </div>
            <div className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
              <div className="col-span-5">
                <p className="font-medium">{user?.email ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Você</p>
              </div>
              <div className="col-span-3">
                <Badge variant={isOwner ? "default" : "secondary"} className="capitalize">
                  {isOwner ? "owner" : primaryRole ?? "—"}
                </Badge>
              </div>
              <div className="col-span-2">
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                >
                  Ativo
                </Badge>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">Agora</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumo de permissões</CardTitle>
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <p className="text-sm text-muted-foreground">
              Como proprietário, você possui acesso total (todas as permissões).
            </p>
          ) : roles.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="Nenhum papel atribuído"
              description="Solicite ao proprietário a atribuição de um perfil."
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(permissions)
                .slice(0, 24)
                .map((p) => (
                  <Badge key={p} variant="outline" className="font-mono text-[10px]">
                    {p}
                  </Badge>
                ))}
              {permissions.size > 24 ? (
                <Badge variant="secondary" className="text-[10px]">
                  +{permissions.size - 24}
                </Badge>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <Link to="/configuracoes/precificacao">
            Ver política de preços <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
