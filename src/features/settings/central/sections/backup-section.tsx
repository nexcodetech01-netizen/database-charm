import {
  DatabaseBackup,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BackupSection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <DatabaseBackup className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Backup dos dados</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Seus dados são armazenados no Supabase, que mantém backups
                automáticos da infraestrutura de banco de dados. Você não
                precisa fazer nada — não há uma ação manual de "backup"
                dentro do NexOS.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
          >
            Gerenciado pela plataforma
          </Badge>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard
          icon={Clock}
          title="Quem cuida disso"
          value="Supabase"
          hint="Backups de infraestrutura, fora do NexOS."
        />
        <InfoCard
          icon={ShieldCheck}
          title="Exportar meus dados"
          value="Via Relatórios"
          hint="Cada tela de Relatórios já permite exportar em CSV/PDF o que você precisar."
        />
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
