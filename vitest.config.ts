import { defineConfig, configDefaults } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // src/routes usa o roteamento por arquivo do TanStack Router, onde "."
    // vira "/" na URL (ex.: bella-pay.test.tsx → rota real /bella-pay/test).
    // Isso colide com o glob de testes acima sempre que uma rota real tem
    // um segmento chamado "test" — excluímos a pasta inteira das rotas,
    // já que arquivos de rota nunca são arquivos de teste.
    exclude: [...configDefaults.exclude, "src/routes/**"],
    environment: "jsdom",
    globals: false,
    coverage: {
      provider: "v8",
      include: [
        "src/features/pricing/engine/**/*.ts",
        "src/features/pricing/resolver/**/*.ts",
        "src/features/pricing/config/**/*.ts",
        "src/features/pricing/persistence/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/index.ts"],


      thresholds: {
        lines: 95,
        statements: 95,
        branches: 85,
        functions: 95,
      },

      reporter: ["text", "text-summary"],
    },
  },
});
