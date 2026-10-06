import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { perfis, type Perfil } from "@/lib/db/schema";
import type { DadosPerfil } from "@/lib/validacao/perfil";
import { exigirId } from "./util";

/** Cria o perfil vazio no primeiro acesso, se ainda não existir. */
export async function garantirPerfil(userId: string): Promise<void> {
  exigirId(userId);
  await db.insert(perfis).values({ userId }).onConflictDoNothing({ target: perfis.userId });
}

export async function obterPerfil(userId: string): Promise<Perfil | null> {
  exigirId(userId);
  const [perfil] = await db.select().from(perfis).where(eq(perfis.userId, userId)).limit(1);
  return perfil ?? null;
}

/** Atualiza só o perfil do próprio usuário. Retorna false se não existir. */
export async function atualizarPerfil(userId: string, dados: DadosPerfil): Promise<boolean> {
  exigirId(userId);
  const linhas = await db
    .update(perfis)
    .set({ ...dados, atualizadoEm: sql`now()` })
    .where(eq(perfis.userId, userId))
    .returning({ userId: perfis.userId });
  return linhas.length === 1;
}
