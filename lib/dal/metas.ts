import "server-only";

import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { metas, type Meta } from "@/lib/db/schema";
import type { DadosMeta } from "@/lib/validacao/metas";
import { ehUuid, exigirId } from "./util";

/** Meta em vigor na data informada (a mais recente com vigente_desde <= data). */
export async function metaVigente(userId: string, data: string): Promise<Meta | null> {
  exigirId(userId);
  const [meta] = await db
    .select()
    .from(metas)
    .where(and(eq(metas.userId, userId), lte(metas.vigenteDesde, data)))
    .orderBy(desc(metas.vigenteDesde))
    .limit(1);
  return meta ?? null;
}

export async function historicoMetas(userId: string, limite = 20): Promise<Meta[]> {
  exigirId(userId);
  return db
    .select()
    .from(metas)
    .where(eq(metas.userId, userId))
    .orderBy(desc(metas.vigenteDesde))
    .limit(limite);
}

export async function obterMeta(userId: string, id: string): Promise<Meta | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [meta] = await db
    .select()
    .from(metas)
    .where(and(eq(metas.id, id), eq(metas.userId, userId)))
    .limit(1);
  return meta ?? null;
}

/**
 * Salva as metas a partir de `hoje`. Linhas de dias anteriores nunca são
 * alteradas (histórico preservado). Se já houver linha de hoje, ela é
 * substituída, porque só pode existir uma por dia.
 */
export async function salvarMeta(userId: string, dados: DadosMeta, hoje: string): Promise<Meta> {
  exigirId(userId);
  const [meta] = await db
    .insert(metas)
    .values({ ...dados, userId, vigenteDesde: hoje })
    .onConflictDoUpdate({ target: [metas.userId, metas.vigenteDesde], set: { ...dados } })
    .returning();
  return meta;
}

/** Apaga uma meta do próprio usuário. Retorna false se não for dele. */
export async function excluirMeta(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const linhas = await db
    .delete(metas)
    .where(and(eq(metas.id, id), eq(metas.userId, userId)))
    .returning({ id: metas.id });
  return linhas.length === 1;
}
