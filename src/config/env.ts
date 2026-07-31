/**
 * Centralized, typed access to public environment variables.
 * Only VITE_* vars are exposed to the client. Server-only secrets
 * must be read inside server functions via process.env.
 */
const requireEnv = (key: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

export const env = {
  supabase: {
    url: requireEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
    anonKey: requireEnv(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ),
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined,
  },
  app: {
    name: "NexOS",
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
  },
} as const;
