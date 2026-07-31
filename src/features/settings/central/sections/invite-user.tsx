import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, Copy, Loader2, MailCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  createInvite,
  listInvites,
  revokeInvite,
} from "@/features/settings/lib/invites.functions";

function useRolesList() {
  return useQuery({
    queryKey: ["roles", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, description")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [result, setResult] = useState<{ url: string; sent: boolean } | null>(null);
  const rolesQuery = useRolesList();
  const qc = useQueryClient();
  const createFn = useServerFn(createInvite);

  const mutation = useMutation({
    mutationFn: async () => {
      return await createFn({
        data: {
          email: email.trim(),
          name: name.trim() || null,
          roleId,
          origin: window.location.origin,
        },
      });
    },
    onSuccess: (res) => {
      setResult({ url: res.inviteUrl, sent: res.emailSent });
      toast.success(
        res.emailSent
          ? "Convite enviado por e-mail."
          : "Convite criado. Envie o link manualmente.",
      );
      qc.invalidateQueries({ queryKey: ["invites", "list"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function reset() {
    setEmail("");
    setName("");
    setRoleId("");
    setResult(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            Envie um convite por e-mail. O usuário criará a senha ou entrará com a conta existente.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {result.sent
                ? "Enviamos o convite por e-mail. Você também pode copiar o link:"
                : "Não conseguimos enviar o e-mail agora. Copie o link e envie manualmente:"}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={result.url} onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(result.url);
                  toast.success("Link copiado.");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!roleId) {
                toast.error("Escolha um perfil.");
                return;
              }
              mutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Nome</Label>
              <Input
                id="inv-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">E-mail</Label>
              <Input
                id="inv-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {(rolesQuery.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id} className="capitalize">
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MailCheck className="mr-2 h-4 w-4" />
                )}
                Enviar convite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PendingInvitesList() {
  const listFn = useServerFn(listInvites);
  const revokeFn = useServerFn(revokeInvite);
  const qc = useQueryClient();
  const invitesQuery = useQuery({
    queryKey: ["invites", "list"],
    queryFn: () => listFn({}),
    staleTime: 30_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeFn({ data: { inviteId } }),
    onSuccess: () => {
      toast.success("Convite revogado.");
      qc.invalidateQueries({ queryKey: ["invites", "list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invites = invitesQuery.data ?? [];
  if (invitesQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando convites…</p>;
  }
  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum convite enviado ainda.</p>;
  }

  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <div className="col-span-5">E-mail</div>
        <div className="col-span-3">Perfil</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2 text-right">Ações</div>
      </div>
      {invites.map((inv) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const role = (inv as any).role;
        return (
          <div
            key={inv.id}
            className="grid grid-cols-12 items-center gap-2 border-b px-4 py-2.5 text-sm last:border-0"
          >
            <div className="col-span-5">
              <p className="font-medium">{inv.email}</p>
              {inv.name ? (
                <p className="text-xs text-muted-foreground">{inv.name}</p>
              ) : null}
            </div>
            <div className="col-span-3 capitalize">{role?.name ?? "—"}</div>
            <div className="col-span-2">
              <Badge
                variant="outline"
                className={
                  inv.status === "pending"
                    ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                    : inv.status === "accepted"
                      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      : "border-muted-foreground/30 text-muted-foreground"
                }
              >
                {inv.status === "pending"
                  ? "Pendente"
                  : inv.status === "accepted"
                    ? "Aceito"
                    : inv.status === "revoked"
                      ? "Revogado"
                      : "Expirado"}
              </Badge>
            </div>
            <div className="col-span-2 text-right">
              {inv.status === "pending" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(inv.id)}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Revogar
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
