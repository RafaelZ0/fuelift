import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

/**
 * Antes dos testes de banco: confere que o alvo é o branch de TESTE e aplica
 * as migrations nele. Sem BANCO_DE_TESTE=sim no .env.test.local, não roda.
 */
export default async function preparar() {
  if (process.env.BANCO_DE_TESTE !== "sim") {
    throw new Error(
      "Testes de banco bloqueados: configure .env.test.local com o branch 'test' do Neon e BANCO_DE_TESTE=sim.",
    );
  }
  const urlMigracoes = process.env.DATABASE_URL_MIGRACOES;
  if (!process.env.DATABASE_URL || !urlMigracoes) {
    throw new Error("DATABASE_URL e DATABASE_URL_MIGRACOES precisam estar no .env.test.local.");
  }
  await migrate(drizzle(neon(urlMigracoes)), { migrationsFolder: "drizzle" });
}
