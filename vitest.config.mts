import nextEnv from "@next/env";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Com NODE_ENV=test, carrega .env.test.local (nunca o .env.local de dev).
(process.env as Record<string, string>).NODE_ENV = "test";
nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // "server-only" só funciona no bundle do Next; nos testes vira módulo vazio.
      "server-only": path.join(import.meta.dirname, "tests/server-only-vazio.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: process.env.VITEST_BANCO === "1" ? ["tests/banco/preparar.ts"] : [],
    exclude: process.env.VITEST_BANCO === "1" ? [] : ["tests/banco/**"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
