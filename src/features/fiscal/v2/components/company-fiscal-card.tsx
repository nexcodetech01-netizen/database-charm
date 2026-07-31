import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  getCompanyFiscalProfile,
  updateCompanyFiscalProfile,
  type CompanyFiscalProfile,
} from "../functions/fiscal.functions";
import { fiscalKeys, useCompanyFiscalProfile } from "../hooks/use-fiscal";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function CompanyFiscalCard() {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateCompanyFiscalProfile);

  const { data, isLoading } = useCompanyFiscalProfile();

  const [form, setForm] = useState<CompanyFiscalProfile>({
    id: "",
    legalName: "",
    tradeName: "",
    cnpj: "",
    ie: "",
    im: "",
    phone: "",
    email: "",
    address: "",
    addressNumber: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipcode: "",
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          legalName: form.legalName ?? "",
          tradeName: form.tradeName ?? null,
          cnpj: (form.cnpj ?? "").replace(/\D/g, ""),
          ie: form.ie ?? null,
          im: form.im ?? null,
          phone: form.phone ?? null,
          email: form.email ?? "",
          address: form.address ?? null,
          addressNumber: form.addressNumber ?? null,
          complement: form.complement ?? null,
          neighborhood: form.neighborhood ?? null,
          city: form.city ?? null,
          state: form.state ?? null,
          zipcode: (form.zipcode ?? "").replace(/\D/g, "") || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.companyProfile() });
      toast.success("Dados fiscais da empresa salvos.");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar empresa."),
  });

  const missing =
    !form.cnpj ||
    !form.legalName ||
    !form.ie ||
    !form.address ||
    !form.city ||
    !form.state ||
    !form.zipcode;

  const set = <K extends keyof CompanyFiscalProfile>(k: K, v: CompanyFiscalProfile[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Dados fiscais da empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            {missing && (
              <Alert variant="destructive">
                <AlertDescription>
                  Complete os campos obrigatórios (CNPJ, razão social, IE e endereço) antes de emitir NF-e.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label>Razão social *</Label>
                <Input value={form.legalName ?? ""} onChange={(e) => set("legalName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Nome fantasia</Label>
                <Input value={form.tradeName ?? ""} onChange={(e) => set("tradeName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>CNPJ *</Label>
                <Input
                  value={formatCnpj(form.cnpj ?? "")}
                  onChange={(e) => set("cnpj", e.target.value.replace(/\D/g, ""))}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-1">
                <Label>Inscrição Estadual *</Label>
                <Input value={form.ie ?? ""} onChange={(e) => set("ie", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Inscrição Municipal</Label>
                <Input value={form.im ?? ""} onChange={(e) => set("im", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>CEP</Label>
                <Input
                  value={formatCep(form.zipcode ?? "")}
                  onChange={(e) => set("zipcode", e.target.value.replace(/\D/g, ""))}
                  placeholder="00000-000"
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <Label>Endereço *</Label>
                <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Número</Label>
                  <Input
                    value={form.addressNumber ?? ""}
                    onChange={(e) => set("addressNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Complemento</Label>
                  <Input value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Bairro</Label>
                <Input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cidade *</Label>
                <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>UF *</Label>
                <Select
                  value={form.state ?? ""}
                  onValueChange={(v) => set("state", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-1.5 h-4 w-4" />
              {save.isPending ? "Salvando…" : "Salvar empresa"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
