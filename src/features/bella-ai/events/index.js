/**
 * Bella IA — Camada de Eventos (barrel)
 *
 * Ponto único de importação. Mantém compatibilidade com os símbolos
 * originais (`bellaEventEngine`, `bellaRecommendationEngine`, `BellaEvent`,
 * `BellaRecommendation`, `BellaEventSource`, `BellaEventType`, etc.) e
 * expõe as novas capacidades (Registry, Priority, Insights, Detectores).
 */
export * from "./BellaEventTypes";
export * from "./BellaEvent";
export * from "./EventPriority";
export * from "./catalog";
export * from "./BellaEventEngine";
export * from "./BellaEventRegistry";
export * from "./BellaRecommendationEngine";
export * from "./insights";
export * from "./detectors";
