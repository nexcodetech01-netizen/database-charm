import { useEffect, useRef, useState } from "react";
import { useEntityForm } from "@/hooks/use-entity-form";
import { useDraft } from "@/hooks/use-draft";
import { DRAFT_KEYS } from "@/lib/draft-storage";
import { DraftAutosave } from "@/components/feedback/draft-autosave";
import { executeWithUndo } from "@/lib/undo-manager";

import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useCreateCustomer, useUpdateCustomer } from "../hooks/use-customers";
import {
  BR_STATES,
  CUSTOMER_SEGMENT_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  type Customer,
  type CustomerInsert,
  type CustomerUpdate,
} from "../types";


const schema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").max(200),
  email: z.string().trim().email("E-mail inválido").max(200).optional().or(z.literal("")),
  document: cpfCnpjSchema,
  phone: phoneSchema,
  whatsapp: phoneSchema,
  zip: cepSchema,
});

interface Props {
  companyId: string;
  customer?: Customer;
  onSaved?: (customer: Customer) => void;
  onCancel?: () => void;
}



type FormState = {
  name: string;
  document: string;
  email: string;
  phone: string;
  whatsapp: string;
  birth_date: string;
  address: string;
  address_number: string;
  address_complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  segment: string;
  status: string;
  notes: string;
  tags: string[];
};

const empty: FormState = {
  name: "",
  document: "",
  email: "",
  phone: "",
  whatsapp: "",
  birth_date: "",
  address: "",
  address_number: "",
  address_complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip: "",
  segment: "",
  status: "active",
  notes: "",
  tags: [],
};

function toState(c?: Customer): FormState {
  if (!c) return empty;
  return {
    name: c.name,
    document: c.document ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    whatsapp: c.whatsapp ?? "",
    birth_date: c.birth_date ?? "",
    address: c.address ?? "",
    address_number: c.address_number ?? "",
    address_complement: c.address_complement ?? "",
    neighborhood: c.neighborhood ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    zip: c.zip ?? "",
    segment: c.segment ?? "",
    status: c.status,
    notes: c.notes ?? "",
    tags: c.tags ?? [],
  };
}

export function CustomerForm({ companyId, customer, onSaved, onCancel }: Props) {
  const navigate = useNavigate();


  const [form, setForm] = useEntityForm(customer, toState);
  const [tagInput, setTagInput] = useState("");


  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer();
  const saving = createMut.isPending || updateMut.isPending;

  // OFFLINE-001 — Rascunho automático (somente em novo cliente).
  const isEdit = !!customer;
  const draftKey = isEdit ? null : DRAFT_KEYS.customer(companyId);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryUpdatedAt, setRecoveryUpdatedAt] = useState<number | null>(null);
  const draftCheckedRef = useRef(false);
  const draft = useDraft({
    key: draftKey,
    value: form,
    isEmpty: (v) => !v.name.trim(),
  });
  useEffect(() => {
    if (isEdit || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const found = draft.load();
    if (found) {
      setRecoveryUpdatedAt(found.updatedAt);
      setRecoveryOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);
  const restoreDraft = () => {
    const found = draft.load();
    if (found?.data) setForm(found.data as FormState);
    setRecoveryOpen(false);
  };
  const discardDraft = () => {
    draft.discard();
    setRecoveryOpen(false);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t)) return;
    set("tags", [...form.tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => {
    const prev = form.tags;
    executeWithUndo({
      message: `✓ Tag "${t}" removida.`,
      apply: () => set("tags", prev.filter((x) => x !== t)),
      undo: () => set("tags", prev),
    });
  };

  const submit = async () => {
    const parsed = schema.safeParse({
      name: form.name,
      email: form.email,
      document: form.document,
      phone: form.phone,
      whatsapp: form.whatsapp,
      zip: form.zip,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    // Validação obrigatória de CNPJ (quando documento tem 14 dígitos).
    const doc = digits(form.document);
    if (doc.length === 14) {
      const check = await ensureValidCnpj(doc);
      if (!check.ok) {
        toast.error(check.message);
        return;
      }
    }
    const basePayload: CustomerUpdate = {
      name: toTitleCasePtBr(form.name),
      document: form.document.trim() ? digits(form.document) : null,
      email: form.email.trim() || null,
      phone: form.phone.trim() ? digits(form.phone) : null,
      whatsapp: form.whatsapp.trim() ? digits(form.whatsapp) : null,
      birth_date: form.birth_date || null,
      address: form.address.trim() || null,
      address_number: form.address_number.trim() || null,
      address_complement: form.address_complement.trim() || null,
      neighborhood: toTitleCasePtBr(form.neighborhood) || null,
      city: toTitleCasePtBr(form.city) || null,
      state: form.state || null,
      zip: form.zip.trim() ? digits(form.zip) : null,
      segment: form.segment || null,
      status: form.status,
      notes: form.notes.trim() || null,
      tags: form.tags,
    };
    try {
      if (customer) {
        const updated = await updateMut.mutateAsync({ id: customer.id, input: basePayload });
        toast.success("Cliente atualizado");
        if (onSaved) {
          onSaved(updated ?? customer);
        } else {
          navigate({ to: "/clientes/$customerId", params: { customerId: customer.id } });
        }
      } else {
        const created = await createMut.mutateAsync({
          ...(basePayload as CustomerInsert),
          company_id: companyId,
        });
        toast.success("Cliente criado");
        // OFFLINE-001 — cliente persistido com sucesso: limpar rascunho.
        draft.discard();
        if (onSaved) {
          onSaved(created);
        } else {
          navigate({ to: "/clientes/$customerId", params: { customerId: created.id } });
        }
      }

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  };


  return (
    <div className="space-y-6">
      <Section title="Dados principais">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome *">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              onBlur={handleTitleCaseBlur((v) => set("name", v))}
            />
          </Field>
          <Field label="CPF/CNPJ">
            <MaskedInput
              mask={CPF_CNPJ_MASK}
              value={form.document}
              onValueChange={(v) => set("document", v)}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Data de nascimento">
            <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <MaskedInput
              mask={PHONE_MASK}
              value={form.phone}
              onValueChange={(v) => set("phone", v)}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="WhatsApp">
            <MaskedInput
              mask={PHONE_MASK}
              value={form.whatsapp}
              onValueChange={(v) => set("whatsapp", v)}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="Segmento">
            <Select
              value={form.segment || "__none"}
              onValueChange={(v) => set("segment", v === "__none" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sem segmento</SelectItem>
                {CUSTOMER_SEGMENT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CUSTOMER_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid gap-4 sm:grid-cols-6">
          {/* Linha 1: CEP + Número — o CEP autopreenche os demais campos */}
          <div className="sm:col-span-2">
            <Field label="CEP">
              <CepInput
                value={form.zip}
                onValueChange={(v) => set("zip", v)}
                onAddressFound={(addr) => {
                  setForm((s) => ({
                    ...s,
                    address: addr.street || s.address,
                    neighborhood: addr.neighborhood || s.neighborhood,
                    city: addr.city || s.city,
                    state: addr.state || s.state,
                  }));
                }}
              />
            </Field>
          </div>
          <div className="sm:col-span-1">
            <Field label="Número">
              <Input value={form.address_number} onChange={(e) => set("address_number", e.target.value)} />
            </Field>
          </div>
          <div className="hidden sm:block sm:col-span-3" aria-hidden />

          {/* Linha 2: Endereço + Complemento */}
          <div className="sm:col-span-4">
            <Field label="Endereço">
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Complemento">
              <Input value={form.address_complement} onChange={(e) => set("address_complement", e.target.value)} />
            </Field>
          </div>

          {/* Linha 3: Bairro + Cidade + UF */}
          <div className="sm:col-span-3">
            <Field label="Bairro">
              <Input
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
                onBlur={handleTitleCaseBlur((v) => set("neighborhood", v))}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Cidade">
              <Input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                onBlur={handleTitleCaseBlur((v) => set("city", v))}
              />
            </Field>
          </div>
          <div className="sm:col-span-1">
            <Field label="UF">
              <Select
                value={form.state || "__none"}
                onValueChange={(v) => set("state", v === "__none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {BR_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Tags e observações">
        <Field label="Tags">
          <div className="flex flex-wrap items-center gap-2">
            {form.tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Nova tag"
                className="h-9 w-40"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>
        </Field>
        <Field label="Observações">
          <Textarea
            rows={4}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Preferências, histórico, contexto..."
          />
        </Field>
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => (onCancel ? onCancel() : navigate({ to: "/clientes" }))} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Salvando..." : customer ? "Salvar alterações" : "Criar cliente"}
        </Button>
      </div>
      <DraftAutosave
        savedAt={draft.savedAt}
        recovery={
          !isEdit
            ? {
                open: recoveryOpen,
                onOpenChange: setRecoveryOpen,
                title: "Cadastro em andamento",
                description:
                  "Foi encontrado um cadastro de cliente em andamento. Deseja continuar?",
                updatedAt: recoveryUpdatedAt,
                onRestore: restoreDraft,
                onDiscard: discardDraft,
              }
            : undefined
        }
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
