import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles } from "lucide-react";

interface FiscalFormProps {
  form: any;
  setForm: (val: any) => void;
  onFiscalAutofill: () => void;
  fiscalLoading?: boolean;
}

export function FiscalForm({ form, setForm, onFiscalAutofill, fiscalLoading }: FiscalFormProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4 md:col-span-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-medium">Dados Tributários</h4>
            <p className="text-xs text-muted-foreground">Essenciais para emissão de NF-e e NFC-e.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onFiscalAutofill}
            disabled={fiscalLoading}
            className="gap-2"
          >
            <Sparkles className={`h-4 w-4 ${fiscalLoading ? "animate-spin" : ""}`} />
            Sugestão IA
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ncm">NCM (Nomenclatura Comum do Mercosul)</Label>
        <div className="flex gap-2">
          <Input
            id="ncm"
            placeholder="Ex: 42022100"
            value={form.ncm}
            onChange={(e) => setForm((s: any) => ({ ...s, ncm: e.target.value.replace(/\D/g, "") }))}
          />
          <Button variant="ghost" size="icon" type="button" title="Consultar NCM">
            <FileText className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Deve conter exatamente 8 dígitos.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cest">CEST (Cód. Especificador da Subst. Tributária)</Label>
        <Input
          id="cest"
          placeholder="Ex: 2804000"
          value={form.cest}
          onChange={(e) => setForm((s: any) => ({ ...s, cest: e.target.value.replace(/\D/g, "") }))}
        />
        <p className="text-[10px] text-muted-foreground">Opcional, 7 dígitos.</p>
      </div>

      <div className="space-y-2">
        <Label>Origem da Mercadoria</Label>
        {/* Placeholder para select de origem (0 a 8) se implementado no motor */}
        <Input disabled placeholder="Nacional (0)" value="0" />
      </div>

      <div className="space-y-2">
        <Label>Unidade Tributável</Label>
        <Input disabled value={form.unit || "UN"} />
      </div>
    </div>
  );
}
