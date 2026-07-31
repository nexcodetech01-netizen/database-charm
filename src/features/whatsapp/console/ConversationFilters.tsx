import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConversationFilterState } from "./types";

const BUCKETS: { value: ConversationFilterState["bucket"]; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "bella", label: "Bella" },
  { value: "human", label: "Humano" },
  { value: "resolved", label: "Resolvidas" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
];

export function ConversationFilters({
  value,
  onChange,
}: {
  value: ConversationFilterState;
  onChange: (v: ConversationFilterState) => void;
}) {
  return (
    <div className="space-y-2 border-b p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar nome, telefone, mensagem ou protocolo…"
          className="h-9 pl-8 text-sm"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </div>
      <Tabs
        value={value.bucket}
        onValueChange={(v) =>
          onChange({ ...value, bucket: v as ConversationFilterState["bucket"] })
        }
      >
        <TabsList className="h-8 w-full justify-start overflow-x-auto scrollbar-none">
          {BUCKETS.map((b) => (
            <TabsTrigger key={b.value} value={b.value} className="h-7 px-2 text-xs">
              {b.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
