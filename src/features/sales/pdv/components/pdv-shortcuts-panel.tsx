import { memo } from "react";

/** Atalhos exibidos no painel discreto do PDV (somente leitura). */
export const PDV_SHORTCUTS: { key: string; label: string }[] = [
  { key: "ENTER", label: "Adicionar" },
  { key: "F2", label: "Cliente" },
  { key: "F3", label: "Quantidade" },
  { key: "F4", label: "Desconto" },
  { key: "F5", label: "Pagamento" },
  { key: "ESC", label: "Limpar" },
  { key: "DEL", label: "Remover item" },
  { key: "CTRL+L", label: "Limpar carrinho" },
];

/**
 * PDVShortcutsPanel — painel visual discreto dos atalhos (Sprint 2.9).
 * Puramente informativo: não registra nenhum listener nem dispara ações.
 */
export const PDVShortcutsPanel = memo(function PDVShortcutsPanel() {
  return (
    <ul
      aria-label="Atalhos do PDV"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
    >
      {PDV_SHORTCUTS.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            {s.key}
          </kbd>
          <span className="text-[11px] text-muted-foreground">{s.label}</span>
        </li>
      ))}
    </ul>
  );
});
