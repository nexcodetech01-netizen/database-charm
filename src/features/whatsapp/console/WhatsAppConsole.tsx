import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, MessageCircle, MessageSquarePlus, Timer, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KpiCard, KpiSection } from "@/components/layout";
import { ConversationFilters } from "./ConversationFilters";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { NewConversationDialog } from "./NewConversationDialog";
import {
  useConsoleConversations,
  useConsoleMetrics,
  useConsoleRealtime,
} from "./hooks";
import type { ConversationFilterState, ConversationListItem } from "./types";

function applyFilters(
  items: ConversationListItem[],
  filters: ConversationFilterState,
): ConversationListItem[] {
  const q = filters.search.trim().toLowerCase();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return items.filter((c) => {
    if (q) {
      const haystack = [
        c.contact_name,
        c.contact_phone,
        c.contact_wa_id,
        c.last_message_text,
        c.protocol,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    switch (filters.bucket) {
      case "unread":
        return c.unread_count > 0;
      case "bella":
        return c.status === "bella" || c.status === "open";
      case "human":
        return c.status === "human";
      case "resolved":
        return c.status === "resolved";
      case "today": {
        const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
        return now - t < dayMs;
      }
      case "week": {
        const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
        return now - t < 7 * dayMs;
      }
      default:
        return true;
    }
  });
}

export function WhatsAppConsole({
  companyId,
  newConversationOpen,
  onNewConversationOpenChange,
}: {
  companyId: string | null;
  newConversationOpen?: boolean;
  onNewConversationOpenChange?: (open: boolean) => void;
}) {
  const list = useConsoleConversations(companyId);
  const metrics = useConsoleMetrics(companyId);
  useConsoleRealtime(companyId, (msg) => {
    toast(`📩 Nova mensagem de ${msg.contact_name}`, {
      description: msg.text,
      action: {
        label: "Ver",
        onClick: () => setSelectedId(msg.conversation_id),
      },
    });
  });

  const [filters, setFilters] = useState<ConversationFilterState>({
    bucket: "all",
    search: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const PAGE_SIZE = 30;
  const dialogOpen = newConversationOpen ?? internalDialogOpen;
  const setDialogOpen = (open: boolean) => {
    if (onNewConversationOpenChange) onNewConversationOpenChange(open);
    else setInternalDialogOpen(open);
  };

  const items = list.data ?? [];
  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);
  const paginated = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  // Reset paginação quando filtros mudarem
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters.bucket, filters.search]);
  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? items.find((c) => c.id === selectedId) ?? null,
    [items, filtered, selectedId],
  );

  // Se a conversa selecionada não existir mais na lista, limpa.
  useEffect(() => {
    if (selectedId && items.length > 0 && !items.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    }
  }, [items, selectedId]);

  const m = metrics.data;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="hidden">
        <KpiCard
          label="Conversas abertas"
          value={m?.open ?? 0}
          icon={MessageCircle}
          hint="Aguardando atendimento"
          loading={metrics.isLoading}
        />
        <KpiCard
          label="Bella"
          value={m?.bella ?? 0}
          icon={Bot}
          hint="Sendo respondidas pela IA"
          loading={metrics.isLoading}
        />
        <KpiCard
          label="Humano"
          value={m?.human ?? 0}
          icon={Users}
          hint="Assumidas por operador"
          loading={metrics.isLoading}
        />
        <KpiCard
          label="Resolvidas"
          value={`${m?.resolutionRate ?? 0}%`}
          icon={CheckCircle2}
          hint="Taxa de resolução"
          loading={metrics.isLoading}
        />
        <KpiCard
          label="Tempo médio"
          value={m?.avgResponseSeconds != null ? `${m.avgResponseSeconds}s` : "—"}
          icon={Timer}
          hint={`${m?.messagesToday ?? 0} mensagens hoje`}
          loading={metrics.isLoading}
        />
      </div>

      <Card className="flex-1 overflow-hidden border-none bg-background/50 shadow-none">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length === items.length
              ? `${items.length} conversa${items.length === 1 ? "" : "s"}`
              : `${filtered.length} de ${items.length} conversa${items.length === 1 ? "" : "s"}`}
            {" · atualização em tempo real"}
          </p>
        </div>
        <div className="grid h-[calc(100vh-280px)] min-h-[600px] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r">
            <ConversationFilters value={filters} onChange={setFilters} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConversationList
                items={paginated}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                isLoading={list.isLoading}
              />
              {paginated.length < filtered.length ? (
                <div className="p-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Carregar mais ({filtered.length - paginated.length} restantes)
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>
          <section className="min-h-0">
            <ConversationView
              selected={selected}
              companyId={companyId}
              onDeleted={() => setSelectedId(null)}
            />
          </section>
        </div>
      </Card>

      <NewConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyId={companyId}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}
