import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useReceiptPreferences } from "../../hooks/use-receipt-preferences";
import type { ReceiptPreferences } from "../../lib/receipt-preferences";

const TOGGLES: {
  key: keyof Omit<ReceiptPreferences, "farewell">;
  label: string;
  hint?: string;
}[] = [
  { key: "showLogo", label: "Mostrar logo" },
  { key: "showAddress", label: "Mostrar endereço" },
  { key: "showPhone", label: "Mostrar telefone" },
  { key: "showWhatsapp", label: "Mostrar WhatsApp" },
  { key: "showSeller", label: "Mostrar vendedor / operador" },
  { key: "showCustomer", label: "Mostrar cliente" },
  { key: "showSocial", label: "Mostrar site e Instagram" },
  { key: "showQrCode", label: "Mostrar QR Code do PIX", hint: "Quando disponível" },
];

export function CupomSection() {
  const { user } = useAuth();
  const companyQ = useQuery({
    queryKey: ["settings", "company", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const companyId = companyQ.data?.id ?? null;
  const { prefs, save } = useReceiptPreferences(companyId);
  const [draft, setDraft] = useState<ReceiptPreferences | null>(null);

  const current = draft ?? prefs;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(prefs);

  const update = (patch: Partial<ReceiptPreferences>) => {
    setDraft({ ...current, ...patch });
  };

  const handleSave = () => {
    if (!draft) return;
    save(draft);
    setDraft(null);
    toast.success("Preferências do cupom atualizadas.");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Cupom Não Fiscal</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Personalize o que aparece no cupom impresso após cada venda.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TOGGLES.map((t) => (
              <label
                key={t.key}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 hover:bg-muted/40 cursor-pointer transition"
              >
                <Checkbox
                  checked={current[t.key]}
                  onCheckedChange={(v) =>
                    update({ [t.key]: !!v } as Partial<ReceiptPreferences>)
                  }
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.label}</div>
                  {t.hint ? (
                    <div className="text-xs text-muted-foreground">{t.hint}</div>
                  ) : null}
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Mensagem final
            </Label>
            <Textarea
              rows={3}
              value={current.farewell}
              onChange={(e) => update({ farewell: e.target.value })}
              placeholder={"Obrigado pela preferência!\nVolte sempre."}
            />
            <p className="text-xs text-muted-foreground">
              Aparece no rodapé do cupom. Uma linha por item.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty}>
          <Save className="mr-2 h-4 w-4" />
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
