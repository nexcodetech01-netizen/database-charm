import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { RequiredLabel } from "@/components/ui/required-label";
import { Controller } from "react-hook-form";
import { PRODUCT_STATUS_OPTIONS, PRODUCT_UNIT_OPTIONS } from "../../../types";
import { useMemo } from "react";

interface GeneralInfoFormProps {
  form: any;
  setForm: (val: any) => void;
  categories: any[];
  suppliers: any[];
  onTitleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  control: any;
  errors?: Record<string, string>;
  onOpenQuickCategory?: () => void;
}

export function GeneralInfoForm({ 
  form, 
  setForm, 
  categories, 
  suppliers, 
  onTitleBlur,
  control,
  errors = {},
  onOpenQuickCategory
}: GeneralInfoFormProps) {
  const unitOptions = useMemo(() => PRODUCT_UNIT_OPTIONS, []);
  const statusOptions = useMemo(() => PRODUCT_STATUS_OPTIONS, []);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4 md:col-span-2 bg-slate-900/30 p-4 rounded-xl border border-slate-800/50 mb-2">
        <Label className="text-xs font-bold uppercase text-slate-400">Tipo de Produto</Label>
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 w-fit">
          <Button
            type="button"
            variant={form.product_type === 'simple' || !form.product_type ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-4 text-xs font-bold"
            onClick={() => setForm((s: any) => ({ ...s, product_type: 'simple' }))}
          >
            Produto Simples
          </Button>
          <Button
            type="button"
            variant={form.product_type === 'kit' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-4 text-xs font-bold"
            onClick={() => setForm((s: any) => ({ ...s, product_type: 'kit' }))}
          >
            Kit / Composto
          </Button>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          {form.product_type === 'kit' 
            ? "O custo e estoque serão baseados na composição dos itens." 
            : "Controle individual de custo e saldo de estoque."}
        </p>
      </div>

      <div className="space-y-4 md:col-span-2">
        <div className="space-y-2">
          <RequiredLabel htmlFor="name" required>Nome do Produto</RequiredLabel>
          <Input
            id="name"
            placeholder="Ex: Camiseta Algodão Premium"
            value={form.name}
            onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))}
            onBlur={onTitleBlur}
            className={errors.name ? "border-destructive ring-destructive" : ""}
          />
          {errors.name && <p className="text-xs text-destructive font-medium">{errors.name}</p>}
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
        <div className="flex items-center justify-between">
          <RequiredLabel htmlFor="category" required>Categoria</RequiredLabel>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 text-primary" 
            type="button"
            onClick={onOpenQuickCategory}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Controller
          name="category_id"
          control={control}
          defaultValue={form.category_id || ""}
          render={({ field }) => (
            <Select
              value={field.value || ""}
              onValueChange={(val) => {
                field.onChange(val);
                setForm((s: any) => ({ ...s, category_id: val }));
              }}
            >
              <SelectTrigger id="category_id" className={errors.category_id ? "border-destructive ring-destructive" : ""}>
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
          )}
        />
        {errors.category_id && <p className="text-xs text-destructive font-medium">{errors.category_id}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier">Fornecedor Principal</Label>
        <Controller
          name="supplier_id"
          control={control}
          defaultValue={form.supplier_id || ""}
          render={({ field }) => (
            <Select
              value={field.value || ""}
              onValueChange={(val) => {
                field.onChange(val);
                setForm((s: any) => ({ ...s, supplier_id: val }));
              }}
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
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Controller
          name="status"
          control={control}
          defaultValue={form.status || "active"}
          render={({ field }) => (
            <Select
              value={field.value || ""}
              onValueChange={(val) => {
                field.onChange(val);
                setForm((s: any) => ({ ...s, status: val }));
              }}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt: any) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit">Unidade</Label>
        <Controller
          name="unit"
          control={control}
          defaultValue={form.unit || "UN"}
          render={({ field }) => (
            <Select
              value={field.value || ""}
              onValueChange={(val) => {
                field.onChange(val);
                setForm((s: any) => ({ ...s, unit: val }));
              }}
            >
              <SelectTrigger id="unit">
                <SelectValue />
              </SelectTrigger>
          <SelectContent>
            {unitOptions.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
}
