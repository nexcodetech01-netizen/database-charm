import { useEffect, useRef, useState } from "react";
import { draftStorage } from "@/lib/draft-storage";

// OFFLINE-001 — Autosave de rascunho.
// - Não persiste durante edição de entidade existente (key = null desabilita).
// - Não persiste se o formulário estiver "vazio" (isEmpty).
// - Debounce curto para evitar escritas excessivas.
// - Executa clearExpired() uma vez por mount (barato).

interface Options<T> {
  key: string | null;
  value: T;
  enabled?: boolean;
  debounceMs?: number;
  isEmpty?: (v: T) => boolean;
}

export function useDraft<T>({
  key,
  value,
  enabled = true,
  debounceMs = 600,
  isEmpty,
}: Options<T>) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const firstRunRef = useRef(true);

  // Limpeza global de expirados (1x por mount deste hook).
  useEffect(() => {
    draftStorage.clearExpired();
  }, []);

  useEffect(() => {
    if (!enabled || !key) return;
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    if (isEmpty && isEmpty(value)) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const t = draftStorage.save(key, value);
      if (t) setSavedAt(t);
    }, debounceMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, value, debounceMs]);

  return {
    savedAt,
    load: () => (key ? draftStorage.load<T>(key) : null),
    discard: () => {
      // Cancela sincronamente uma gravação já agendada. Apenas desabilitar o
      // hook via estado React não é suficiente: o cleanup do effect acontece
      // depois e o timer pode recriar a chave entre o remove e o próximo render.
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (key) draftStorage.remove(key);
      setSavedAt(null);
    },
  };
}
