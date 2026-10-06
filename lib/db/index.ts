import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL não configurada.");
}

// Driver HTTP do Neon, recomendado para funções serverless (Vercel).
// DATABASE_URL usa o papel do app (só SELECT/INSERT/UPDATE/DELETE).
export const db = drizzle(neon(url), { schema });
export type Db = typeof db;
