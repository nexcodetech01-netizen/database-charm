import { useState, type FormEvent } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { authService } from "../services/auth.service";

interface Props {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch {
      toast.error("Não foi possível enviar o email de recuperação.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Se existe uma conta com <span className="font-medium text-foreground">{email}</span>, você receberá um link para redefinir a senha.
        </p>
        <Button variant="outline" className="w-full" onClick={onBack}>
          Voltar para o login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com.br"
        />
        <p className="text-xs text-muted-foreground">
          Enviaremos um link para você criar uma nova senha.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de recuperação"}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="mx-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>
    </form>
  );
}
