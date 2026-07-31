import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.{test,spec}.ts"],
    environment: "node",
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
