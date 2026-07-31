/**
 * Bella Event Engine — barrel público.
 *
 * IMPORTANTE: este barrel é intencionalmente separado de `index.ts`
 * (que ainda serve o barramento antigo `BellaEventEngine` usado pelo
 * dashboard). Consumidores do NOVO Event Engine devem importar de
 * `@/features/bella-ai/events/nexos-events.index`.
 */
export * from "./types";
export * from "./EventFilter";
export * from "./EventRegistry";
export * from "./EventDetector";
export * from "./EventQueue";
export * from "./EventDispatcher";
export * from "./EventHistory";
export * from "./EventMetrics";
export * from "./EventEngine";
export * from "./hooks";
