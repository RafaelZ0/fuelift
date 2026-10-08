import "server-only";

import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { aplicacoes, perfis, pesagens, type Pesagem } from "@/lib/db/schema";
import { ehUuid, exigirId } from "./util";

export type DadosPesagem = { pesoKg: number; massaMagraKg: number | null; cinturaCm: number | null };

export async function listarPesagens(userId: string, desde: string | null = null, limite = 730): Promise<Pesagem[]> {
  exigirId(userId);
  return db
    .select()
    .from(pesagens)
    .where(desde ? and(eq(pesagens.userId, userId), gte(pesagens.data, desde)) : eq(pesagens.userId, userId))
    .orderBy(desc(pesagens.data))
    .limit(limite);
}

/** Uma pesagem por dia: salvar de novo no mesmo dia atualiza. */
export async function salvarPesagem(userId: string, data: string, dados: DadosPesagem): Promise<void> {
  exigirId(userId);
  await db
    .insert(pesagens)
    .values({ userId, data, ...dados })
    .onConflictDoUpdate({ target: [pesagens.userId, pesagens.data], set: { ...dados } });
}

export async function apagarPesagem(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const linhas = await db
    .delete(pesagens)
    .where(and(eq(pesagens.id, id), eq(pesagens.userId, userId)))
    .returning({ id: pesagens.id });
  return linhas.length === 1;
}

// ─── Aplicação semanal (só o registro de "feito") ───

export async function datasDeAplicacao(userId: string, desde: string): Promise<string[]> {
  exigirId(userId);
  const linhas = await db
    .select({ data: aplicacoes.data })
    .from(aplicacoes)
    .where(and(eq(aplicacoes.userId, userId), gte(aplicacoes.data, desde)))
    .orderBy(desc(aplicacoes.data))
    .limit(60);
  return linhas.map((l) => l.data);
}

export async function registrarAplicacao(userId: string, data: string): Promise<void> {
  exigirId(userId);
  await db.insert(aplicacoes).values({ userId, data }).onConflictDoNothing();
}

export async function desfazerAplicacao(userId: string, data: string): Promise<void> {
  exigirId(userId);
  await db.delete(aplicacoes).where(and(eq(aplicacoes.userId, userId), eq(aplicacoes.data, data)));
}

export async function obterDiaAplicacao(userId: string): Promise<number | null> {
  exigirId(userId);
  const [p] = await db.select({ dia: perfis.diaAplicacao }).from(perfis).where(eq(perfis.userId, userId)).limit(1);
  return p?.dia ?? null;
}

export async function definirDiaAplicacao(userId: string, dia: number | null): Promise<void> {
  exigirId(userId);
  await db.update(perfis).set({ diaAplicacao: dia }).where(eq(perfis.userId, userId));
}
