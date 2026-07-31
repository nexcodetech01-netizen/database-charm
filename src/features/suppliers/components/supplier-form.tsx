import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MaskedInput, CPF_CNPJ_MASK, PHONE_MASK } from "@/components/ui/masked-input";
import { CepInput } from "@/components/ui/cep-input";
import { handleTitleCaseBlur, toTitleCasePtBr } from "@/lib/text-format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { digits } from "@/lib/masks";
import { cpfCnpjSchema, phoneSchema, cepSchema } from "@/lib/validators";
import { ensureValidCnpj } from "@/lib/cnpj-validation";
import { useCreateSupplier, useUpdateSupplier } from "../hooks/use-suppliers";
import {
  BR_STATES,
  PAYMENT_TERM_OPTIONS,
  SUPPLIER_STATUS_OPTIONS,
  type Supplier,
  type SupplierInsert,
  type SupplierUpdate,
} from "../types";
import { useEntityForm } from "@/hooks/use-entity-form";



interface Props {
  companyId: string;
  supplier?: Supplier;
  /** When provided, replaces default navigation on success (e.g. dialog usage). */
  onSaved?: (supplier: Supplier) => void;
  /** When provided, called on Cancel button (e.g. close dialog). */
  onCancel?: () => void;
  /** Compact = dialog usage: removes internal card chrome, tighter spacing. */
  variant?: "page" | "dialog";
}

const schema = z.object({
  name: z.string().trim().min(1, "Nome fantasia é obrigatório").max(160),
  email: z.string().trim().max(200).email("E-mail inválido").optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  document: cpfCnpjSchema,
  phone: phoneSchema,
  whatsapp: phoneSchema,
  zip: cepSchema,
});

type FormState = {
  name: string;
  legal_name: string;
  document: string;
  state_registration: string;
  municipal_registration: string;
  contact_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  zip: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  payment_terms: string;
  delivery_days: string;
  notes: string;
  status: string;
};

const empty: FormState = {
  name: "",
  legal_name: "",
  document: "",
  state_registration: "",
  municipal_registration: "",
  contact_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  zip: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  payment_terms: "",
  delivery_days: "",
  notes: "",
  status: "active",
};

const NONE = "__none__";

export function SupplierForm({
  companyId,
  supplier,
  onSaved,
  onCancel,
  variant = "page",
}: Props) {
  const navigate = useNavigate();
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier();
  const isEdit = !!supplier;
  const isDialog = variant === "dialog";

  const [form, setForm] = useEntityForm<Supplier | undefined, FormState>(
    supplier,
    (s) =>
      s
        ? {
            name: s.name ?? "",
            legal_name: s.legal_name ?? "",
            document: s.document ?? "",
            state_registration: s.state_registration ?? "",
            municipal_registration: s.municipal_registration ?? "",
            contact_name: s.contact_name ?? "",
            phone: s.phone ?? "",
            whatsapp: s.whatsapp ?? "",
            email: s.email ?? "",
            website: s.website ?? "",
            zip: s.zip ?? "",
            address: s.address ?? "",
            number: s.number ?? "",
            complement: s.complement ?? "",
            neighborhood: s.neighborhood ?? "",
            city: s.city ?? "",
            state: s.state ?? "",
            payment_terms: s.payment_terms ?? "",
            delivery_days: s.delivery_days != null ? String(s.delivery_days) : "",
            notes: s.notes ?? "",
            status: s.status ?? "active",
          }
        : empty,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});


  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      name: form.name,
      email: form.email,
      website: form.website,
      document: form.document,
      phone: form.phone,
      whatsapp: form.whatsapp,
      zip: form.zip,
    });
    if (!parsed.success) {
      const fieldErrs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        fieldErrs[String(i.path[0])] = i.message;
      });
      setErrors(fieldErrs);
      return;
    }
    setErrors({});

    // Validação obrigatória de CNPJ (quando documento tem 14 dígitos).
    const docDigits = digits(form.document);
    if (docDigits.length === 14) {
      const check = await ensureValidCnpj(docDigits);
      if (!check.ok) {
        setErrors({ document: check.message });
        toast.error(check.message);
        return;
      }
    }

    const basePayload: SupplierUpdate = {
      name: toTitleCasePtBr(form.name),
      legal_name: toTitleCasePtBr(form.legal_name) || null,
      document: form.document.trim() ? digits(form.document) : null,
      state_registration: form.state_registration.trim() || null,
      municipal_registration: form.municipal_registration.trim() || null,
      contact_name: toTitleCasePtBr(form.contact_name) || null,
      phone: form.phone.trim() ? digits(form.phone) : null,
      whatsapp: form.whatsapp.trim() ? digits(form.whatsapp) : null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      zip: form.zip.trim() ? digits(form.zip) : null,
      address: form.address.trim() || null,
      number: form.number.trim() || null,
      complement: form.complement.trim() || null,
      neighborhood: toTitleCasePtBr(form.neighborhood) || null,
      city: toTitleCasePtBr(form.city) || null,
      state: form.state || null,
      payment_terms: form.payment_terms || null,
      delivery_days: form.delivery_days ? Number(form.delivery_days) : null,
      notes: form.notes.trim() || null,
      status: form.status,
    };

    try {
      const saved =
        isEdit && supplier
          ? await updateMut.mutateAsync({ id: supplier.id, input: basePayload })
          : await createMut.mutateAsync({
              ...(basePayload as SupplierInsert),
              company_id: companyId,
            });

      toast.success(isEdit ? "Fornecedor atualizado" : "Fornecedor cadastrado");
      if (onSaved) {
        onSaved(saved);
      } else {
        navigate({
          to: "/fornecedores/$supplierId",
          params: { supplierId: saved.id },
        });
      }
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  }

  const submitting = createMut.isPending || updateMut.isPending;

  return (
    <form onSubmit={handleSubmit} className={isDialog ? "space-y-5" : "space-y-6"}>
      <Section
        title="Identificação"
        description="Dados cadastrais e documentação da empresa."
        bare={isDialog}
      >
        <div className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-3">
            <Field label="Nome fantasia" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={handleTitleCaseBlur((v) => set("name", v))}
                placeholder="Ex.: Distribuidora Sul"
                autoFocus
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Razão social">
              <Input
                value={form.legal_name}
                onChange={(e) => set("legal_name", e.target.value)}
                onBlur={handleTitleCaseBlur((v) => set("legal_name", v))}
                placeholder="Ex.: Distribuidora Sul LTDA"
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="CNPJ / CPF" error={errors.document}>
              <MaskedInput
                mask={CPF_CNPJ_MASK}
                value={form.document}
                onValueChange={(v) => set("document", v)}
                placeholder="00.000.000/0000-00"
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Inscrição estadual">
              <Input
                value={form.state_registration}
                onChange={(e) => set("state_registration", e.target.value)}
                placeholder="Isento ou nº IE"
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Inscrição municipal">
              <Input
                value={form.municipal_registration}
                onChange={(e) => set("municipal_registration", e.target.value)}
                placeholder="Nº IM (opcional)"
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Contato" description="Como falar com o fornecedor." bare={isDialog}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Contato responsável">
            <Input
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
              onBlur={handleTitleCaseBlur((v) => set("contact_name", v))}
              placeholder="Nome do vendedor / representante"
            />
          </Field>
          <Field label="Telefone" error={errors.phone}>
            <MaskedInput
              mask={PHONE_MASK}
              value={form.phone}
              onValueChange={(v) => set("phone", v)}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp}>
            <MaskedInput
              mask={PHONE_MASK}
              value={form.whatsapp}
              onValueChange={(v) => set("whatsapp", v)}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="E-mail" error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="contato@empresa.com"
            />
          </Field>
          <Field label="Site" error={errors.website}>
            <Input
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Endereço"
        description="Preencha o CEP para completar automaticamente."
        bare={isDialog}
      >
        <div className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <Field label="CEP" error={errors.zip}>
              <CepInput
                value={form.zip}
                onValueChange={(v) => set("zip", v)}
                onAddressFound={(addr) => {
                  setForm((f) => ({
                    ...f,
                    address: addr.street || f.address,
                    neighborhood: addr.neighborhood || f.neighborhood,
                    city: addr.city || f.city,
                    state: addr.state || f.state,
                  }));
                }}
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Rua">
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Ex.: Av. Paulista"
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Número">
              <Input
                value={form.number}
                onChange={(e) => set("number", e.target.value)}
                placeholder="Nº"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Complemento">
              <Input
                value={form.complement}
                onChange={(e) => set("complement", e.target.value)}
                placeholder="Sala, andar…"
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Bairro">
              <Input
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
                onBlur={handleTitleCaseBlur((v) => set("neighborhood", v))}
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Cidade">
              <Input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                onBlur={handleTitleCaseBlur((v) => set("city", v))}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Estado">
              <Select
                value={form.state || NONE}
                onValueChange={(v) => set("state", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {BR_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title="Comercial"
        description="Condições de pagamento e prazos de entrega padrão."
        bare={isDialog}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Condição de pagamento">
            <Select
              value={form.payment_terms || NONE}
              onValueChange={(v) => set("payment_terms", v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {PAYMENT_TERM_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prazo médio de entrega (dias)">
            <Input
              type="number"
              min={0}
              value={form.delivery_days}
              onChange={(e) => set("delivery_days", e.target.value)}
              placeholder="Ex.: 7"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Observações"
        description="Anotações internas sobre o fornecedor."
        bare={isDialog}
      >
        <Textarea
          rows={isDialog ? 3 : 4}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Condições especiais, contatos alternativos, histórico de negociação…"
        />
      </Section>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : navigate({ to: "/fornecedores" }))}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {isEdit ? "Salvar alterações" : "Cadastrar fornecedor"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
  bare,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  bare?: boolean;
}) {
  if (bare) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
