import "server-only";

import { and, between, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { passosDia, tokensApi, type TokenApi } from "@/lib/db/schema";
import { exigirId, ehUuid } from "./util";

// ─── Passos ───

export async function salvarPassos(userId: string, data: string, passos: number, origem: "atalhos" | "manual" = "atalhos"): Promise<void> {
  exigirId(userId);
  await db
    .insert(passosDia)
    .values({ userId, data, passos, origem })
    .onConflictDoUpdate({ target: [passosDia.userId, passosDia.data], set: { passos, origem, atualizadoEm: sql`now()` } });
}

export async function passosDoPeriodo(userId: string, de: string, ate: string): Promise<Array<{ data: string; passos: number }>> {
  exigirId(userId);
  return db
    .select({ data: passosDia.data, passos: passosDia.passos })
    .from(passosDia)
    .where(and(eq(passosDia.userId, userId), between(passosDia.data, de, ate)))
    .orderBy(passosDia.data);
}

// ─── Tokens da API ───

export const MAX_TOKENS_ATIVOS = 5;

export async function listarTokens(userId: string): Promise<Array<Pick<TokenApi, "id" | "nome" | "criadoEm" | "ultimoUso" | "revogadoEm">>> {
  exigirId(userId);
  return db
    .select({ id: tokensApi.id, nome: tokensApi.nome, criadoEm: tokensApi.criadoEm, ultimoUso: tokensApi.ultimoUso, revogadoEm: tokensApi.revogadoEm })
    .from(tokensApi)
    .where(eq(tokensApi.userId, userId))
    .orderBy(tokensApi.criadoEm)
    .limit(20);
}

/** Cria o token (só o hash vai ao banco). Retorna false se já houver o máximo de tokens ativos. */
export async function criarTokenApi(userId: string, nome: string, hash: string): Promise<boolean> {
  exigirId(userId);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tokensApi)
    .where(and(eq(tokensApi.userId, userId), isNull(tokensApi.revogadoEm)));
  if (n >= MAX_TOKENS_ATIVOS) return false;
  await db.insert(tokensApi).values({ userId, nome, hash });
  return true;
}

export async function revogarTokenApi(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const l = await db
    .update(tokensApi)
    .set({ revogadoEm: sql`now()` })
    .where(and(eq(tokensApi.id, id), eq(tokensApi.userId, userId), isNull(tokensApi.revogadoEm)))
    .returning({ id: tokensApi.id });
  return l.length === 1;
}

/**
 * Autenticação por token: acha o dono pelo hash (único passo sem user_id conhecido). Token revogado = null.
 * Marca o uso no máximo uma vez por minuto.
 */
export async function usuarioDoToken(hash: string): Promise<{ userId: string; tokenId: string } | null> {
  const [t] = await db
    .select({ id: tokensApi.id, userId: tokensApi.userId, revogadoEm: tokensApi.revogadoEm, ultimoUso: tokensApi.ultimoUso })
    .from(tokensApi)
    .where(eq(tokensApi.hash, hash))
    .limit(1);
  if (!t || t.revogadoEm) return null;
  if (!t.ultimoUso || Date.now() - t.ultimoUso.getTime() > 60_000) {
    await db.update(tokensApi).set({ ultimoUso: sql`now()` }).where(eq(tokensApi.id, t.id));
  }
  return { userId: t.userId, tokenId: t.id };
}
