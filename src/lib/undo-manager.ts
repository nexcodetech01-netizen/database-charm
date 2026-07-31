/**
 * UndoManager — utilitário único para toasts com ação "Desfazer".
 *
 * Padrão NEXOS 3.0 (HISTORY-001):
 *   ✓ Ação executada         [Desfazer]
 *
 * - Toast único e padronizado (sonner) — nunca criar variações.
 * - Janela de reversão: 8 segundos (default). Após expirar, o toast some
 *   e `undo()` não faz nada.
 * - Estado apenas em memória (sessão) — nada é persistido.
 * - Não altera regras de negócio, banco, triggers ou serviços; o `onUndo`
 *   apenas restaura estado local ou reinvoca APIs já existentes.
 */
import { toast } from "sonner";

export interface OfferUndoOptions {
  /**
   * Mensagem principal do toast. Convenção: começar com "✓ …" e usar
   * frases curtas — ex.: "Produto removido da venda.".
   */
  message: string;
  /** Callback executado quando o usuário clica em "Desfazer". */
  onUndo: () => void | Promise<void>;
  /** Janela de reversão em ms. Default 8000. */
  timeoutMs?: number;
  /** Texto do botão. Default "Desfazer". */
  actionLabel?: string;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Exibe um toast padronizado de sucesso com botão "Desfazer".
 * Retorna uma função `cancel()` que remove o toast (útil em cenários
 * em que a ação foi consolidada e não pode mais ser revertida).
 */
export function offerUndo(opts: OfferUndoOptions): () => void {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let done = false;

  const id = toast(opts.message, {
    duration: timeoutMs,
    action: {
      label: opts.actionLabel ?? "Desfazer",
      onClick: () => {
        if (done) return;
        done = true;
        try {
          void opts.onUndo();
        } catch {
          // silencioso — undo é best-effort
        }
      },
    },
  });

  return () => {
    done = true;
    toast.dismiss(id);
  };
}

/**
 * Açúcar para ações locais: executa a ação imediatamente e oferece
 * undo com um `restore` que reverte o estado local capturado.
 *
 * Exemplo:
 *   executeWithUndo({
 *     message: "✓ Produto removido da venda.",
 *     apply: () => onChange(items.filter((_, i) => i !== idx)),
 *     undo:  () => onChange(prevItems),
 *   });
 */
export function executeWithUndo(params: {
  message: string;
  apply: () => void;
  undo: () => void;
  timeoutMs?: number;
}): void {
  params.apply();
  offerUndo({
    message: params.message,
    onUndo: params.undo,
    timeoutMs: params.timeoutMs,
  });
}
