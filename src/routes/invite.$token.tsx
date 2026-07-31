import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, AlertCircle, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { NexosLogo } from "@/components/brand/nexos-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInviteByToken, acceptInvite } from "@/features/settings/lib/invites.functions";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const getInvite = useServerFn(getInviteByToken);
  const accept = useServerFn(acceptInvite);

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInvite({ data: { token } }),
    staleTime: 30_000,
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [accepting, setAccepting] = useState(false);

  const invite = inviteQuery.data;
  const emailMismatch = useMemo(() => {
    if (!user || !invite?.valid) return false;
    return (user.email ?? "").toLowerCase() !== invite.email.toLowerCase();
  }, [user, invite]);

  // Persist token so it survives the Supabase auth roundtrip (email
  // confirmation, tab reloads). Cleared after accept or when invalid.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (invite && !invite.valid) {
      window.localStorage.removeItem("nexos:pending-invite-token");
      return;
    }
    if (emailMismatch) {
      // Convite pertence a outro e-mail; não deixe o token grudado no owner.
      window.localStorage.removeItem("nexos:pending-invite-token");
      return;
    }
    if (token) {
      window.localStorage.setItem("nexos:pending-invite-token", token);
    }
  }, [token, invite, emailMismatch]);


  useEffect(() => {
    if (invite?.valid && invite.name && !name) setName(invite.name);
  }, [invite, name]);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await accept({ data: { token } });
      return res;
    },
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("nexos:pending-invite-token");
      }
      toast.success("Convite aceito. Bem-vindo(a)!");
      navigate({ to: "/dashboard" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Auto-accept when logged in with matching email
  useEffect(() => {
    if (
      !authLoading &&
      user &&
      invite?.valid &&
      !emailMismatch &&
      !acceptMutation.isPending &&
      !acceptMutation.isSuccess
    ) {
      acceptMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, invite, emailMismatch]);

  async function handleSignUpAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!invite?.valid) return;
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setAccepting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: { full_name: name || null },
          emailRedirectTo: `${window.location.origin}/invite/${token}`,
        },
      });
      if (error) {
        // If already registered, try signing in
        if (error.message.toLowerCase().includes("already")) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: invite.email,
            password,
          });
          if (signInErr) throw signInErr;
        } else {
          throw error;
        }
      }
      // Wait for the session, then trigger accept via effect
      await new Promise((r) => setTimeout(r, 400));
      acceptMutation.mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setAccepting(false);
    }
  }

  async function handleSignInAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!invite?.valid) return;
    setAccepting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });
      if (error) throw error;
      await new Promise((r) => setTimeout(r, 200));
      acceptMutation.mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2">
          <NexosLogo size={36} />
          <span className="text-lg font-semibold">NexOS</span>
        </div>

        {inviteQuery.isLoading ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Verificando convite…</p>
            </CardContent>
          </Card>
        ) : !invite?.valid ? (
          <InvalidInvite reason={invite?.reason ?? "not_found"} />
        ) : emailMismatch ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Este convite é para outro e-mail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Você está conectado(a) como <strong>{user?.email}</strong>, mas o convite é para{" "}
                <strong>{invite.email}</strong>.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem("nexos:pending-invite-token");
                  }
                  await supabase.auth.signOut();
                  window.location.reload();
                }}
              >
                Sair e continuar
              </Button>

            </CardContent>
          </Card>
        ) : acceptMutation.isPending || acceptMutation.isSuccess ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Vinculando você à empresa…</p>
            </CardContent>
          </Card>
        ) : user ? null : (
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">Você foi convidado(a)</CardTitle>
              <p className="text-sm text-muted-foreground">
                <strong>{invite.companyName}</strong> convidou você para o NexOS como{" "}
                <span className="capitalize">{invite.roleName}</span>.
              </p>
            </CardHeader>
            <CardContent>
              <SignUpOrSignInTabs
                email={invite.email}
                name={name}
                setName={setName}
                password={password}
                setPassword={setPassword}
                confirm={confirm}
                setConfirm={setConfirm}
                accepting={accepting}
                onSignUp={handleSignUpAndAccept}
                onSignIn={handleSignInAndAccept}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SignUpOrSignInTabs(props: {
  email: string;
  name: string;
  setName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirm: string;
  setConfirm: (v: string) => void;
  accepting: boolean;
  onSignUp: (e: React.FormEvent) => void;
  onSignIn: (e: React.FormEvent) => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "signup" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setMode("signup")}
        >
          Criar conta
        </Button>
        <Button
          type="button"
          variant={mode === "signin" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setMode("signin")}
        >
          Já tenho conta
        </Button>
      </div>

      {mode === "signup" ? (
        <form onSubmit={props.onSignUp} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={props.email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              value={props.name}
              onChange={(e) => props.setName(e.target.value)}
              placeholder="Como devemos te chamar?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={props.password}
              onChange={(e) => props.setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              value={props.confirm}
              onChange={(e) => props.setConfirm(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={props.accepting}>
            {props.accepting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Criar conta e aceitar convite
          </Button>
        </form>
      ) : (
        <form onSubmit={props.onSignIn} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email2">E-mail</Label>
            <Input id="email2" value={props.email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password2">Senha</Label>
            <Input
              id="password2"
              type="password"
              value={props.password}
              onChange={(e) => props.setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={props.accepting}>
            {props.accepting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MailCheck className="mr-2 h-4 w-4" />
            )}
            Entrar e aceitar convite
          </Button>
        </form>
      )}
    </div>
  );
}

function InvalidInvite({ reason }: { reason: string }) {
  const label =
    reason === "expired"
      ? "Este convite expirou. Peça um novo ao administrador."
      : reason === "accepted"
        ? "Este convite já foi aceito."
        : reason === "revoked"
          ? "Este convite foi revogado."
          : "Convite não encontrado.";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-destructive" />
          Convite indisponível
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
