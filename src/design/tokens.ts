/**
 * NexOS — Design Tokens (EPIC UI.1 · Sprint UI.1.1)
 *
 * Fundação visual única. Este módulo é **somente apresentação**: não contém
 * regra de negócio, serviço, hook, rota ou acesso a dados.
 *
 * Os valores vivem em `src/styles.css` (CSS custom properties). Aqui ficam
 * apenas os nomes das classes utilitárias correspondentes, para que os
 * componentes parem de escolher cores/raios/sombras arbitrariamente.
 *
 * Proibido a partir desta sprint: `emerald`, `green`, `red`, `yellow`,
 * `rose` e `amber` diretamente em componentes — use `STATUS_TOKENS`.
 */

export const STATUS_KEYS = [
  "info",
  "success",
  "warning",
  "danger",
  "neutral",
  "critical",
  "pending",
  "processing",
  "approved",
  "rejected",
  "cancelled",
  "draft",
] as const;

export type StatusToken = (typeof STATUS_KEYS)[number];

export type StatusTokenClasses = {
  /** Cor de preenchimento sólido (badge forte, barra, ponto). */
  solid: string;
  /** Superfície suave + texto legível (badge padrão, chip). */
  soft: string;
  /** Apenas texto. */
  text: string;
  /** Apenas borda. */
  border: string;
  /** Ponto/indicador. */
  dot: string;
};

function statusClasses(key: StatusToken): StatusTokenClasses {
  return {
    solid: `bg-status-${key} text-status-${key}-foreground`,
    soft: `bg-status-${key}-surface text-status-${key} border-status-${key}/25`,
    text: `text-status-${key}`,
    border: `border-status-${key}`,
    dot: `bg-status-${key}`,
  };
}

export const STATUS_TOKENS: Record<StatusToken, StatusTokenClasses> =
  STATUS_KEYS.reduce(
    (acc, key) => {
      acc[key] = statusClasses(key);
      return acc;
    },
    {} as Record<StatusToken, StatusTokenClasses>,
  );

/** Acesso seguro: qualquer valor desconhecido cai em `neutral`. */
export function statusToken(key: string | null | undefined): StatusTokenClasses {
  return STATUS_TOKENS[(key ?? "") as StatusToken] ?? STATUS_TOKENS.neutral;
}

/* ------------------------------------------------------------------ */
/* Radius — apenas três degraus                                        */
/* ------------------------------------------------------------------ */

export const RADIUS_TOKENS = {
  sm: "rounded-sm",
  lg: "rounded-lg",
  xl: "rounded-xl",
} as const;

export type RadiusToken = keyof typeof RADIUS_TOKENS;

/* ------------------------------------------------------------------ */
/* Elevação — apenas quatro níveis                                     */
/* ------------------------------------------------------------------ */

export const SHADOW_TOKENS = {
  surface: "shadow-surface",
  card: "shadow-card",
  floating: "shadow-floating",
  overlay: "shadow-overlay",
} as const;

export type ShadowToken = keyof typeof SHADOW_TOKENS;

/* ------------------------------------------------------------------ */
/* Tipografia — escala única (sem text-[11px] & cia.)                  */
/* ------------------------------------------------------------------ */

export const TEXT_TOKENS = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
} as const;

export type TextToken = keyof typeof TEXT_TOKENS;

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

export const MOTION_TOKENS = {
  fast: "duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)]",
  normal: "duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
  slow: "duration-[320ms] ease-[cubic-bezier(0.3,0,0,1)]",
} as const;

export type MotionToken = keyof typeof MOTION_TOKENS;

export const MOTION_DURATION_MS: Record<MotionToken, number> = {
  fast: 120,
  normal: 200,
  slow: 320,
};

/** Transições padrão de interação. */
export const INTERACTION_TOKENS = {
  hover: `transition-colors ${MOTION_TOKENS.fast}`,
  focus:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
} as const;

/* ------------------------------------------------------------------ */
/* Spacing — densidade de blocos                                       */
/* ------------------------------------------------------------------ */

export const SPACING_TOKENS = {
  compact: { gap: "gap-2", padding: "p-2", stack: "space-y-2" },
  normal: { gap: "gap-3", padding: "p-3", stack: "space-y-3" },
  comfortable: { gap: "gap-4", padding: "p-4", stack: "space-y-4" },
  relaxed: { gap: "gap-6", padding: "p-6", stack: "space-y-6" },
} as const;

export type SpacingToken = keyof typeof SPACING_TOKENS;

export const DESIGN_TOKENS = {
  status: STATUS_TOKENS,
  radius: RADIUS_TOKENS,
  shadow: SHADOW_TOKENS,
  text: TEXT_TOKENS,
  motion: MOTION_TOKENS,
  interaction: INTERACTION_TOKENS,
  spacing: SPACING_TOKENS,
} as const;
