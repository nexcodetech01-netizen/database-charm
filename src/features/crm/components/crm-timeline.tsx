import { formatDateTime } from "@/lib/format";
import type { CrmEvent } from "../types";
import { Activity } from "lucide-react";

const LABELS: Record<string, string> = {
  opportunity_created: "Oportunidade criada",
  stage_changed: "Etapa alterada",
  opportunity_won: "Oportunidade ganha",
  opportunity_lost: "Oportunidade perdida",
  opportunity_reopened: "Oportunidade reaberta",
  note: "Observação",
  campaign_sent: "Campanha enviada",
  campaign_created: "Campanha criada",
};

export function CrmTimeline({ events }: { events: CrmEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum evento registrado ainda.
      </div>
    );
  }
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {events.map((ev) => (
        <li key={ev.id} className="relative">
          <span className="absolute -left-[27px] top-1 grid h-5 w-5 place-items-center rounded-full border bg-background">
            <Activity className="h-3 w-3 text-muted-foreground" />
          </span>
          <div className="text-sm font-medium">
            {LABELS[ev.event_type] ?? ev.event_type}
          </div>
          {ev.description ? (
            <div className="text-sm text-muted-foreground">{ev.description}</div>
          ) : null}
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {formatDateTime(ev.occurred_at)}
          </div>
        </li>
      ))}
    </ol>
  );
}
