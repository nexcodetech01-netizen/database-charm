import { useState, type ChangeEvent } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  fiscalKeys,
  useDeactivateCertificate,
  useFiscalCertificates,
  useUploadCertificate,
} from "../hooks/use-fiscal";
import {
  deleteFiscalCertificate,
  setCertificatePassword,
} from "../functions/fiscal.functions";
import { isPfxMetadata, parsePfx, type PfxMetadata } from "../lib/pfx-parser";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type ParseState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "ok"; metadata: PfxMetadata }
  | { status: "invalid-password" }
  | { status: "invalid-file"; message: string };

export function CertificateCard() {
  const list = useFiscalCertificates();
  const upload = useUploadCertificate();
  const deactivate = useDeactivateCertificate();
  const qc = useQueryClient();
  const setPassword = useServerFn(setCertificatePassword);
  const deleteCert = useServerFn(deleteFiscalCertificate);

  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [alias, setAlias] = useState("");
  const [password, setPassword_] = useState("");
  const [parseState, setParseState] = useState<ParseState>({ status: "idle" });

  const [pwdCertId, setPwdCertId] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState("");

  const savePwd = useMutation({
    mutationFn: ({ id, pwd }: { id: string; pwd: string }) =>
      setPassword({ data: { certificateId: id, password: pwd } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.certificates() });
      toast.success("Senha do certificado armazenada com segurança.");
      setPwdCertId(null);
      setPwdValue("");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar senha."),
  });

  const removeCert = useMutation({
    mutationFn: (id: string) => deleteCert({ data: { certificateId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.certificates() });
      toast.success("Certificado removido.");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao remover."),
  });

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setParseState({ status: "idle" });
    setFileBase64("");
    if (!f) return;
    if (!alias) setAlias(f.name.replace(/\.(pfx|p12)$/i, ""));
    const b64 = await fileToBase64(f);
    setFileBase64(b64);
  }

  async function handleValidate() {
    if (!fileBase64) {
      toast.error("Selecione o arquivo do certificado primeiro.");
      return;
    }
    if (!password) {
      toast.error("Informe a senha do certificado.");
      return;
    }
    setParseState({ status: "parsing" });
    const result = await parsePfx(fileBase64, password);
    if (isPfxMetadata(result)) {
      setParseState({ status: "ok", metadata: result });
      toast.success("Certificado validado com sucesso.");
    } else if (result.kind === "invalid-password") {
      setParseState({ status: "invalid-password" });
      toast.error("Senha do certificado inválida.");
    } else {
      setParseState({ status: "invalid-file", message: result.message });
      toast.error(`Arquivo inválido: ${result.message}`);
    }
  }

  async function handleUpload() {
    if (parseState.status !== "ok" || !file) return;
    const { metadata } = parseState;
    const created = await upload.mutateAsync({
      alias: alias.trim() || metadata.subjectName,
      subjectName: metadata.subjectName,
      subjectCnpj: metadata.subjectCnpj ?? "00000000000000",
      issuerName: metadata.issuerName,
      validFrom: metadata.validFrom,
      validTo: metadata.validTo,
      serialNumber: metadata.serialNumber,
      thumbprint: metadata.thumbprint,
      fileBase64,
      contentType: file.type || "application/x-pkcs12",
    });
    // Salva a senha cifrada logo em seguida
    if (created?.id) {
      await savePwd.mutateAsync({ id: created.id, pwd: password });
    }
    setFile(null);
    setFileBase64("");
    setAlias("");
    setPassword_("");
    setParseState({ status: "idle" });
  }

  const canSubmit = parseState.status === "ok" && !upload.isPending;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Enviar certificado A1
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Todos os campos são extraídos automaticamente do arquivo .pfx.
            A senha é cifrada com AES-256-GCM antes de sair do navegador.
          </p>
          <div className="space-y-1">
            <Label>Arquivo .pfx / .p12 *</Label>
            <Input
              type="file"
              accept=".pfx,.p12,application/x-pkcs12"
              onChange={handleFileChange}
            />
          </div>
          <div className="space-y-1">
            <Label>Senha do certificado *</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword_(e.target.value)}
              autoComplete="new-password"
              placeholder="Digite a senha do PFX"
            />
          </div>
          <div className="space-y-1">
            <Label>Apelido</Label>
            <Input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Ex.: NF-e Matriz 2026"
            />
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={handleValidate}
            disabled={!file || !password || parseState.status === "parsing"}
          >
            {parseState.status === "parsing" ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Validando…</>
            ) : (
              <><ShieldCheck className="mr-1.5 h-4 w-4" /> Validar certificado</>
            )}
          </Button>

          {parseState.status === "ok" && <PfxSummary metadata={parseState.metadata} />}
          {parseState.status === "invalid-password" && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Senha do certificado inválida.
              </AlertDescription>
            </Alert>
          )}
          {parseState.status === "invalid-file" && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Arquivo inválido: {parseState.message}
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={handleUpload}
          >
            {upload.isPending ? "Enviando…" : "Salvar certificado"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Certificados cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !list.data || list.data.length === 0 ? (
            <EmptyState
              icon={ShieldOff}
              title="Nenhum certificado ativo"
              description="Envie um certificado A1 para começar a emitir NF-e."
            />
          ) : (
            <ul className="space-y-3">
              {list.data.map((c) => {
                const expiresAt = c.validTo ? new Date(c.validTo) : null;
                const daysLeft = expiresAt
                  ? Math.round((expiresAt.getTime() - Date.now()) / 86_400_000)
                  : null;
                const expired = daysLeft != null && daysLeft < 0;
                const expiring = daysLeft != null && daysLeft >= 0 && daysLeft < 30;
                return (
                  <li key={c.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium truncate">{c.alias}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.subjectName} · CNPJ {c.subjectCnpj}
                        </p>
                        {c.issuerName && (
                          <p className="text-xs text-muted-foreground">
                            Emitente: {c.issuerName}
                          </p>
                        )}
                        {c.serialNumber && (
                          <p className="text-xs text-muted-foreground">
                            Série: <span className="font-mono">{c.serialNumber}</span>
                          </p>
                        )}
                        {c.thumbprint && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Fingerprint className="h-3 w-3" />
                            <span className="font-mono truncate">{c.thumbprint}</span>
                          </p>
                        )}
                        <p className="text-xs">
                          <span className="text-muted-foreground">Válido até: </span>
                          {expiresAt ? format(expiresAt, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          {daysLeft != null && (
                            <span
                              className={
                                expired
                                  ? " text-rose-500"
                                  : expiring
                                    ? " text-amber-500"
                                    : " text-emerald-500"
                              }
                            >
                              {" "}({expired ? `expirado há ${-daysLeft}d` : `${daysLeft}d restantes`})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={c.isActive ? "default" : "secondary"} className="gap-1">
                          {c.isActive ? <CheckCircle2 className="h-3 w-3" /> : null}
                          {c.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPwdCertId(c.id);
                              setPwdValue("");
                            }}
                          >
                            <KeyRound className="mr-1 h-3 w-3" /> Senha
                          </Button>
                          {c.isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={deactivate.isPending}
                              onClick={() => deactivate.mutate(c.id)}
                            >
                              Desativar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={removeCert.isPending}
                              onClick={() => {
                                if (confirm(`Remover certificado "${c.alias}"?`)) removeCert.mutate(c.id);
                              }}
                            >
                              <Trash2 className="mr-1 h-3 w-3" /> Remover
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pwdCertId} onOpenChange={(open) => !open && setPwdCertId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir senha do certificado</DialogTitle>
            <DialogDescription>
              A senha é cifrada com AES-256-GCM antes de ser armazenada. Ela nunca sai do servidor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={pwdValue}
              onChange={(e) => setPwdValue(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwdCertId(null)}>Cancelar</Button>
            <Button
              disabled={!pwdValue || savePwd.isPending}
              onClick={() => pwdCertId && savePwd.mutate({ id: pwdCertId, pwd: pwdValue })}
            >
              {savePwd.isPending ? "Salvando…" : "Salvar senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PfxSummary({ metadata }: { metadata: PfxMetadata }) {
  const validTo = new Date(metadata.validTo);
  const daysLeft = Math.round((validTo.getTime() - Date.now()) / 86_400_000);
  const expired = daysLeft < 0;
  const expiring = !expired && daysLeft < 30;
  return (
    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs space-y-1.5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" /> Certificado válido
      </p>
      <Row label="Titular" value={metadata.subjectName} />
      <Row label="CNPJ" value={metadata.subjectCnpj ?? "—"} />
      <Row label="Emitente" value={metadata.issuerName} />
      <Row
        label="Validade"
        value={
          `${format(new Date(metadata.validFrom), "dd/MM/yyyy", { locale: ptBR })}` +
          ` até ${format(validTo, "dd/MM/yyyy", { locale: ptBR })}` +
          ` (${expired ? "expirado" : `${daysLeft}d`})`
        }
        tone={expired ? "danger" : expiring ? "warn" : undefined}
      />
      <Row label="Série" value={metadata.serialNumber} mono />
      <Row label="Thumbprint" value={metadata.thumbprint} mono />
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "warn" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "text-rose-600 dark:text-rose-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "";
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`col-span-2 font-medium ${toneCls} ${mono ? "font-mono text-[11px] break-all" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
