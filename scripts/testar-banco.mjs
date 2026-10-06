// Roda os testes de banco (isolamento entre usuários) no branch de teste do Neon.
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["vitest", "run", "tests/banco"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, VITEST_BANCO: "1" },
});
process.exit(r.status ?? 1);
