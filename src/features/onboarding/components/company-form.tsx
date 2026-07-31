import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { companyService } from "../services/company.service";
import { ensureValidCnpj } from "@/lib/cnpj-validation";
import { digits } from "@/lib/masks";

interface Props {
  userId: string;
  onDone: () => void;
  initial?: {
    name?: string | null;
    trade_name?: string | null;
    cnpj?: string | null;
    segment?: string | null;
    size?: string | null;
  };
}

const SEGMENTS = [
  "Varejo",
  "Serviços",
  "Indústria",
  "Alimentação",
  "Beleza e estética",
  "Saúde",
  "Educação",
  "Tecnologia",
  "Outros",
];

const SIZES = [
  { value: "1", label: "Apenas eu" },
  { value: "2-5", label: "2 a 5 pessoas" },
  { value: "6-20", label: "6 a 20 pessoas" },
  { value: "21-50", label: "21 a 50 pessoas" },
  { value: "50+", label: "Mais de 50 pessoas" },
];

export function CompanyForm({ userId, onDone, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tradeName, setTradeName] = useState(initial?.trade_name ?? "");
  const [cnpj, setCnpj] = useState(initial?.cnpj ?? "");
  const [segment, setSegment] = useState<string>(initial?.segment ?? "");
  const [size, setSize] = useState<string>(initial?.size ?? "");
  const [loading, setLoading] = useState(false);


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Validação obrigatória de CNPJ quando informado.
      const cnpjDigits = digits(cnpj);
      if (cnpjDigits) {
        const check = await ensureValidCnpj(cnpjDigits);
        if (!check.ok) {
          toast.error(check.message);
          setLoading(false);
          return;
        }
      }
      await companyService.createCompany(userId, {
        name,
        trade_name: tradeName || null,
        cnpj: cnpjDigits || null,
        segment: segment || null,
        size: size || null,
      });
      toast.success("Empresa cadastrada!");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="company-name">Razão social *</Label>
        <Input
          id="company-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bella Comércio Ltda"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="trade-name">Nome fantasia</Label>
          <Input
            id="trade-name"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            placeholder="Bella Store"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Segmento</Label>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s} value={s} textValue={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tamanho da equipe</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value} textValue={s.label}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Concluir cadastro"}
      </Button>
    </form>
  );
}
