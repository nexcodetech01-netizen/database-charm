import { Link } from "@tanstack/react-router";
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SEVERITY_LABEL,
  groupBySeverity,
  issueLink,
  type HealthIssue,
  type HealthSeverity,
} from "../lib/health";

const ICON: Record<HealthSeverity, typeof Info> = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};
const TONE: Record<HealthSeverity, string> = {
  critical: "text-red-500",
  warning: "text-amber-500",
  info: "text-sky-500",
};

export function SystemHealthList({ issues }: { issues: HealthIssue[] }) {
  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="font-medium">Tudo certo</p>
            <p className="text-sm text-muted-foreground">
              Estoque, contas, vendas, compras e vales conferidos. Nada fora do lugar.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {groupBySeverity(issues).map((g) => {
        const Icon = ICON[g.severity];
        return (
          <section key={g.severity} className="space-y-2">
            <h2 className={cn("flex items-center gap-2 text-sm font-semibold", TONE[g.severity])}>
              <Icon className="h-4 w-4" /> {SEVERITY_LABEL[g.severity]} ({g.items.length})
            </h2>
            <Card>
              <CardContent className="divide-y p-0">
                {g.items.map((it, i) => {
                  const href = issueLink(it);
                  const body = (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{it.title}</p>
                        <p className="text-sm text-muted-foreground">{it.detail}</p>
                      </div>
                      {href ? (
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : null}
                    </div>
                  );
                  return href ? (
                    <Link
                      key={`${it.code}-${it.ref_id ?? it.ref_label ?? i}`}
                      to={href.split("?")[0] as never}
                      search={
                        (href.includes("?")
                          ? Object.fromEntries(new URLSearchParams(href.split("?")[1]))
                          : undefined) as never
                      }
                      className="block hover:bg-muted/50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={`${it.code}-${i}`}>{body}</div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
