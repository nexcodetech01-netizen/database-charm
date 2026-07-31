import { toast } from "sonner";
import {
  DatabaseBackup,
  ShieldCheck,
  Clock,
  CloudDownload,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function BackupSection() {
  const lastBackup = new Date();
  lastBackup.setHours(lastBackup.getHours() - 3);
  const formatted = lastBackup.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <DatabaseBackup className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Backup automático</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Seus dados são copiados todos os dias pela plataforma. Você não precisa
                fazer nada.
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
        <CardContent className="pt-2">
          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Último backup</p>
            <p className="mt-0.5 font-medium">{formatted}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard icon={Clock} title="Frequência" value="Diário" hint="Snapshot completo a cada 24h." />
        <InfoCard
          icon={ShieldCheck}
          title="Retenção"
          value="7 dias"
          hint="Histórico disponível para restauração."
        />
        <InfoCard
          icon={CloudDownload}
          title="Exportação"
          value="Sob demanda"
          hint="Relatórios exportáveis em CSV e PDF."
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.info("Gerando exportação completa dos dados…")}
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" /> Exportar dados
        </Button>
        <Button
          size="sm"
          onClick={() => toast.success("Backup manual iniciado")}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Fazer backup agora
        </Button>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: typeof DatabaseBackup;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <p className="mt-0.5 text-xs font-semibold text-foreground">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
