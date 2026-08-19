/**
 * Bella IA — Prioridade de eventos
 *
 * Escala determinística usada pelo Registry para ordenar as prioridades
 * exibidas na Home. Independente da `severity` (visual) — a prioridade é
 * o eixo operacional: o que a Bella deve empurrar primeiro para o usuário.
 */
export const EventPriority = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
};
const ORDER = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3,
};
/**
 * Comparador estilo `Array.sort`: prioridade maior primeiro.
 * `comparePriority("CRITICAL", "LOW")` → negativo (CRITICAL vem antes).
 */
export function comparePriority(a, b) {
    return ORDER[b] - ORDER[a];
}
/**
 * Fallback determinístico quando o detector não informa `priority`.
 * Mantém a escala visual (severity) consistente com a operacional.
 */
export function priorityFromSeverity(severity) {
    switch (severity) {
        case "critical":
            return EventPriority.CRITICAL;
        case "warning":
            return EventPriority.HIGH;
        case "success":
            return EventPriority.MEDIUM;
        case "info":
        default:
            return EventPriority.LOW;
    }
}
