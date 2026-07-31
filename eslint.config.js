import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // ADR-016 — bloqueia service_role fora de *.server.ts / src/routes/api/**
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.server.ts", "src/routes/api/**", "src/integrations/supabase/client.server.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message: "Use `*.server.ts` naming instead.",
            },
            {
              name: "@/integrations/supabase/client.server",
              message:
                "supabaseAdmin é proibido nesta camada (ADR-016). Use ExecutionContext.supabase (RLS) ou mova para um arquivo *.server.ts dedicado.",
            },
          ],
          patterns: [
            {
              group: ["**/client.server"],
              message:
                "Import de admin client apenas em *.server.ts / src/routes/api (ADR-016).",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name=/SERVICE_ROLE/]",
          message:
            "SERVICE_ROLE só pode ser acessado em arquivos *.server.ts (ADR-016).",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
