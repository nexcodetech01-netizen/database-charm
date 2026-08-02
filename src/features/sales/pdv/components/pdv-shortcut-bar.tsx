import { memo } from "react";
import { cn } from "@/lib/utils";
import { PDV_LAYOUT } from "../lib/layout";
import { PDV_SHORTCUTS } from "./pdv-shortcuts-panel";

/**
 * PDVShortcutBar — rodapé discreto com o mapa de atalhos (Sprint PDV.3.1).
 *
 * Somente leitura: não registra nenhum listener e não abre diálogo.
 * As teclas exibidas são exatamente as já implementadas no hook de atalhos.
 */
export const PDVShortcutBar = memo(function PDVShortcutBar({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-label="Atalhos do PDV"
      className={cn(PDV_LAYOUT.shortcutBar, className)}
    >
      {PDV_SHORTCUTS.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <kbd className="rounded border bg-muted px-1 py-px font-mono text-[10px] font-semibold uppercase">
            {s.key}
          </kbd>
          {s.label}
        </span>
      ))}
    </div>
  );
});
