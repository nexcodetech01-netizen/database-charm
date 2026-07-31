import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CreditCard,
  ExternalLink,
  QrCode,
  Landmark,
  Receipt,
  Webhook,
  Percent,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Painel de resumo do Bella Pay — status, webhook, parcelamento e taxa.
 * A configuração de conta real vive em /bella-pay (não duplicamos lógica).
 */
export function BellaPaySection() {
  const [installments, setInstallments] = useState("3");
  const [feeAbsorb, setFeeAbsorb] = useState("customer");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Bella Pay</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Receba por PIX, cartão e boleto direto do NexOS.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
          >
            Ativo
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 pt-2 sm:grid-cols-2">
          <InfoLine label="Conta conectada" value="Asaas Produção" />
          <InfoLine label="Ambiente" value="Produção" />
          <InfoLine label="Webhook" value="Configurado automaticamente" />
          <InfoLine label="Última cobrança" value="Sincronizada agora" />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MethodCard icon={QrCode} title="PIX" desc="Recebimento instantâneo, sem taxa por transação." />
        <MethodCard
          icon={CreditCard}
          title="Cartão de crédito"
          desc="Aprovação em segundos, parcelamento em até 3x."
        />
        <MethodCard icon={Receipt} title="Boleto" desc="Cobranças com vencimento programado." />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Parcelamento e taxas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Máximo de parcelas (cartão)
            </Label>
            <Select value={installments} onValueChange={setInstallments}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x (à vista)</SelectItem>
                <SelectItem value="2">Até 2x</SelectItem>
                <SelectItem value="3">Até 3x</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quem paga a taxa</Label>
            <Select value={feeAbsorb} onValueChange={setFeeAbsorb}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Cliente (repassar)</SelectItem>
                <SelectItem value="store">Loja (absorver)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Conta de recebimento</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 pt-0 text-sm text-muted-foreground">
          <Landmark className="h-4 w-4" />
          Gerenciada em{" "}
          <Link to="/bella-pay" className="text-primary underline underline-offset-2">
            Bella Pay
          </Link>
          .
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/bella-pay">
            <Webhook className="mr-1.5 h-3.5 w-3.5" /> Abrir Bella Pay
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={() => toast.success("Preferências de Bella Pay salvas")}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar
        </Button>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium">
        <Percent className="h-3 w-3 opacity-0" /> {value}
      </span>
    </div>
  );
}

function MethodCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof CreditCard;
  title: string;
  desc: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
