import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_STATUS_OPTIONS, PRODUCT_UNIT_OPTIONS } from "../../../types";

interface GeneralInfoFormProps {
  form: any;
  setForm: (val: any) => void;
  categories: any[];
  suppliers: any[];
  onTitleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export function GeneralInfoForm({ form, setForm, categories, suppliers, onTitleBlur }: GeneralInfoFormProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4 md:col-span-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Produto</Label>
          <Input
            id="name"
            placeholder="Ex: Camiseta Algodão Premium"
            value={form.name}
            onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))}
            onBlur={onTitleBlur}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            placeholder="Detalhes técnicos, materiais, benefícios..."
            className="min-h-[100px]"
            value={form.description}
            onChange={(e) => setForm((s: any) => ({ ...s, description: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categoria</Label>
        <Select
          value={form.category_id}
          onValueChange={(val) => setForm((s: any) => ({ ...s, category_id: val }))}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier">Fornecedor Principal</Label>
        <Select
          value={form.supplier_id}
          onValueChange={(val) => setForm((s: any) => ({ ...s, supplier_id: val }))}
        >
          <SelectTrigger id="supplier">
            <SelectValue placeholder="Selecione um fornecedor" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={form.status}
          onValueChange={(val) => setForm((s: any) => ({ ...s, status: val }))}
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_STATUS_OPTIONS.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit">Unidade</Label>
        <Select
          value={form.unit}
          onValueChange={(val) => setForm((s: any) => ({ ...s, unit: val }))}
        >
          <SelectTrigger id="unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_UNIT_OPTIONS.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
