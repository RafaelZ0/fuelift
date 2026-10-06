// Aplica as migrations no branch de PRODUÇÃO do Neon.
// Lê DATABASE_URL_MIGRACOES do .env.main.local (fora do git). Rode só depois de testar no dev.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const linha = readFileSync(".env.main.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL_MIGRACOES="));
const url = linha?.slice("DATABASE_URL_MIGRACOES=".length).trim();
if (!url) {
  console.error("DATABASE_URL_MIGRACOES não encontrada em .env.main.local.");
  process.exit(1);
}

const r = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL_MIGRACOES: url },
});
process.exit(r.status ?? 1);
