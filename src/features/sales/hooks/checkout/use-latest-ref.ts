import { useLayoutEffect, useRef } from "react";

/**
 * Ref que sempre aponta para o valor do último render.
 * Útil para callbacks usados dentro de assinaturas (realtime, timers) sem
 * precisar refazer a assinatura a cada render — e sem capturar valores velhos.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
