import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Palette,
  QrCode,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useResolvedCompanyId } from "@/hooks/use-resolved-company-id";
import { companyBrandingService } from "@/services/company-branding.service";
import { useCompanyBranding } from "../../hooks/use-company-branding";
import { offerUndo } from "@/lib/undo-manager";
import { ensureValidCnpj } from "@/lib/cnpj-validation";
import { digits } from "@/lib/masks";

type CompanyForm = {
  name: string;
  trade_name: string;
  cnpj: string;
  ie: string;
  im: string;
  segment: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  zip_code: string;
  address: string;
  address_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  primary_color: string;
  secondary_color: string;
  pix_key: string;
  pix_key_type: string;
  pix_recipient_name: string;
  pix_recipient_city: string;
};

const empty: CompanyForm = {
  name: "",
  trade_name: "",
  cnpj: "",
  ie: "",
  im: "",
  segment: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  zip_code: "",
  address: "",
  address_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  primary_color: "",
  secondary_color: "",
  pix_key: "",
  pix_key_type: "",
  pix_recipient_name: "",
  pix_recipient_city: "",
};


export function EmpresaSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { companyId, isLoading: companyIdLoading } = useResolvedCompanyId(user?.id);

  const companyQ = useQuery({
    queryKey: ["settings", "company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId as string)
        .maybeSingle();
      return data;
    },
  });

  const brandingQ = useCompanyBranding(companyId);

  const [form, setForm] = useState<CompanyForm>(empty);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const d = companyQ.data as Record<string, string | null> | undefined;
    if (!d) return;
    setForm({
      name: d.name ?? "",
      trade_name: d.trade_name ?? "",
      cnpj: d.cnpj ?? "",
      ie: d.ie ?? "",
      im: d.im ?? "",
      segment: d.segment ?? "",
      phone: d.phone ?? "",
      whatsapp: d.whatsapp ?? "",
      email: d.email ?? "",
      website: d.website ?? "",
      zip_code: d.zip_code ?? "",
      address: d.address ?? "",
      address_number: d.address_number ?? "",
      complement: d.complement ?? "",
      neighborhood: d.neighborhood ?? "",
      city: d.city ?? "",
      state: d.state ?? "",
      primary_color: d.primary_color ?? "",
      secondary_color: d.secondary_color ?? "",
      pix_key: d.pix_key ?? "",
      pix_key_type: d.pix_key_type ?? "",
      pix_recipient_name: d.pix_recipient_name ?? "",
      pix_recipient_city: d.pix_recipient_city ?? "",
    });
    setDirty(false);
  }, [companyQ.data]);


  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não encontrada");
      // Validação obrigatória de CNPJ quando informado.
      const cnpjDigits = digits(form.cnpj);
      if (cnpjDigits) {
        const check = await ensureValidCnpj(cnpjDigits);
        if (!check.ok) {
          throw new Error(check.message);
        }
      }
      const payload: Record<string, string | null> = {};
      (Object.keys(form) as (keyof CompanyForm)[]).forEach((k) => {
        const v = form[k].trim();
        payload[k] = v === "" ? null : v;
      });
      payload.name = form.name.trim(); // obrigatório
      payload.cnpj = cnpjDigits || null;
      const { error } = await supabase
        .from("companies")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(payload as any)
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados da empresa atualizados");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["settings", "company"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao salvar"),
  });

  const set = <K extends keyof CompanyForm>(k: K, v: string) => {
    setForm((s) => ({ ...s, [k]: v }));
    setDirty(true);
  };

  async function handleLogoFile(file: File) {
    if (!companyId) return;
    setUploading(true);
    try {
      const oldPath = (companyQ.data as { logo_path?: string | null } | null)
        ?.logo_path;
      const path = await companyBrandingService.uploadLogo(companyId, file);
      const { error } = await supabase
        .from("companies")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ logo_path: path } as any)
        .eq("id", companyId);
      if (error) throw error;
      if (oldPath) await companyBrandingService.removeLogo(oldPath);
      toast.success("Logo atualizada");
      qc.invalidateQueries({ queryKey: ["settings", "company"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    if (!companyId) return;
    const oldPath = (companyQ.data as { logo_path?: string | null } | null)
      ?.logo_path;
    if (!oldPath) return;
    // Captura o blob antes de deletar — permite "Desfazer" reenviando o arquivo.
    const currentLogoUrl = brandingQ.data?.logoUrl ?? null;
    let cachedBlob: Blob | null = null;
    let cachedName = "logo.png";
    try {
      if (currentLogoUrl) {
        const r = await fetch(currentLogoUrl);
        if (r.ok) {
          cachedBlob = await r.blob();
          const guess = oldPath.split("/").pop();
          if (guess) cachedName = guess;
        }
      }
    } catch {
      // se falhar o cache, seguimos sem undo funcional
    }

    setUploading(true);
    try {
      const { error } = await supabase
        .from("companies")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ logo_path: null } as any)
        .eq("id", companyId);
      if (error) throw error;
      await companyBrandingService.removeLogo(oldPath);
      qc.invalidateQueries({ queryKey: ["settings", "company"] });
      qc.invalidateQueries({ queryKey: ["company"] });
      offerUndo({
        message: "✓ Logo removida.",
        onUndo: async () => {
          if (!cachedBlob) {
            toast.error("Não foi possível desfazer — logo indisponível para reenvio.");
            return;
          }
          try {
            const file = new File([cachedBlob], cachedName, {
              type: cachedBlob.type || "image/png",
            });
            const path = await companyBrandingService.uploadLogo(companyId, file);
            const { error: upErr } = await supabase
              .from("companies")
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .update({ logo_path: path } as any)
              .eq("id", companyId);
            if (upErr) throw upErr;
            qc.invalidateQueries({ queryKey: ["settings", "company"] });
            qc.invalidateQueries({ queryKey: ["company"] });
            toast.success("Logo restaurada");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao restaurar logo");
          }
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    } finally {
      setUploading(false);
    }
  }

  if (companyIdLoading || companyQ.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!companyId || !companyQ.data) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma empresa vinculada"
        description="Complete o onboarding para exibir os dados da empresa."
      />
    );
  }

  const logoUrl = brandingQ.data?.logoUrl ?? null;

  return (
    <div className="space-y-4">
      {/* Identidade — logo */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Logo da empresa</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Aparece no cupom não fiscal, PDFs, orçamentos e materiais
                gerados pela Bella. PNG, JPG ou WEBP — até 2 MB.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoFile(f);
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {logoUrl ? "Trocar logo" : "Enviar logo"}
            </Button>
            {logoUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveLogo}
                disabled={uploading}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remover
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Dados */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Dados da empresa</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Informações institucionais e fiscais.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Razão social *">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Nome fantasia">
            <Input
              value={form.trade_name}
              onChange={(e) => set("trade_name", e.target.value)}
            />
          </Field>
          <Field label="CNPJ">
            <Input
              value={form.cnpj}
              onChange={(e) => set("cnpj", e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Segmento">
            <Input
              value={form.segment}
              onChange={(e) => set("segment", e.target.value)}
              placeholder="Ex.: Moda, Alimentação, Serviços"
            />
          </Field>
          <Field label="Inscrição Estadual">
            <Input value={form.ie} onChange={(e) => set("ie", e.target.value)} />
          </Field>
          <Field label="Inscrição Municipal">
            <Input value={form.im} onChange={(e) => set("im", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="(11) 3000-0000"
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="contato@empresa.com"
            />
          </Field>
          <Field label="Site">
            <Input
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Endereço</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Aparece em cupons, orçamentos e PDFs.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Field label="CEP">
              <Input
                value={form.zip_code}
                onChange={(e) => set("zip_code", e.target.value)}
                placeholder="00000-000"
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Endereço">
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-1">
            <Field label="Número">
              <Input
                value={form.address_number}
                onChange={(e) => set("address_number", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Complemento">
              <Input
                value={form.complement}
                onChange={(e) => set("complement", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Bairro">
              <Input
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label="Cidade">
              <Input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Estado (UF)">
              <Input
                value={form.state}
                maxLength={2}
                onChange={(e) => set("state", e.target.value.toUpperCase())}
                placeholder="SP"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* PIX Próprio — recebimento direto na conta do lojista */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">PIX Próprio</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Configure a chave PIX que receberá pagamentos diretamente na sua
                conta bancária, sem intermediário. Usada no checkout na opção
                &ldquo;PIX Próprio&rdquo;.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo de chave">
            <select
              value={form.pix_key_type}
              onChange={(e) => set("pix_key_type", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Chave aleatória</option>
            </select>
          </Field>
          <Field label="Chave PIX">
            <Input
              value={form.pix_key}
              onChange={(e) => set("pix_key", e.target.value)}
              placeholder="Ex.: 12345678901, email@dominio.com"
            />
          </Field>
          <Field label="Nome do recebedor">
            <Input
              value={form.pix_recipient_name}
              onChange={(e) => set("pix_recipient_name", e.target.value)}
              placeholder="Nome exibido no app do pagador (até 25 chars)"
              maxLength={25}
            />
          </Field>
          <Field label="Cidade do recebedor">
            <Input
              value={form.pix_recipient_city}
              onChange={(e) => set("pix_recipient_city", e.target.value)}
              placeholder="Ex.: SAO PAULO"
              maxLength={15}
            />
          </Field>
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Identidade visual</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Opcional. Usado pela Bella ao gerar materiais e por peças
                impressas coloridas.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorField
            label="Cor principal"
            value={form.primary_color}
            onChange={(v) => set("primary_color", v)}
          />
          <ColorField
            label="Cor secundária"
            value={form.secondary_color}
            onChange={(v) => set("secondary_color", v)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending || !form.name.trim()}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isHex ? value : "#3b82f6"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border bg-background"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3b82f6"
        />
      </div>
    </div>
  );
}
