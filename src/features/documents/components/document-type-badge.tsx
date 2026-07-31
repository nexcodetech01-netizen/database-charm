import { DOCUMENT_TYPE_LABELS } from "../data";
import { DOCUMENT_TYPE_ICON } from "../icons";
import type { DocumentType } from "../types";

export function DocumentTypeBadge({ type }: { type: DocumentType }) {
  const Icon = DOCUMENT_TYPE_ICON[type];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {DOCUMENT_TYPE_LABELS[type]}
    </span>
  );
}
