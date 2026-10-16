import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { authService } from "../services/auth.service";

interface Props {
  onSuccess: () => void;
  onForgotPassword: () => void;
}

export function SignInForm({ onSuccess, onForgotPassword }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Aviso fixo embaixo da senha (o toast some sozinho e dá para não ver).
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await authService.signIn(email, password);
      onSuccess();
    } catch (err) {
      const raw = err instanceof Error ? err.message.toLowerCase() : "";
      const msg = raw.includes("email not confirmed")
        ? "Seu email ainda não foi confirmado. Abra o link que enviamos para o seu email."
        : raw.includes("invalid login") || raw.includes("invalid credentials")
          ? "Email ou senha incorretos."
          : raw.includes("fetch") || raw.includes("network")
            ? "Sem conexão com o servidor. Verifique a internet e tente de novo."
            : "Não foi possível entrar. Confira email e senha e tente de novo.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com.br"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Senha</Label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs font-medium text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder="••••••••"
          aria-invalid={errorMsg ? true : undefined}
          aria-describedby={errorMsg ? "signin-error" : undefined}
        />
        {errorMsg ? (
          <p id="signin-error" role="alert" className="text-sm font-medium text-destructive">
            {errorMsg}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
      </Button>
    </form>
  );
}
