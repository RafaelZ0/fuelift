import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

// Migrations usam a URL direta (sem pooler) com o papel dono do banco.
// Essa URL fica só na sua máquina, nunca no Vercel.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRACOES ?? "",
  },
  strict: true,
  verbose: true,
});
