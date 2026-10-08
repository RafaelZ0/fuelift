import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agua } from "@/lib/db/schema";
import { totalAgua } from "@/lib/treino";
import { ehUuid, exigirId } from "./util";

export async function listarAguaDoDia(userId: string, data: string) {
  exigirId(userId);
  return db
    .select({ id: agua.id, ml: agua.ml, horario: agua.horario })
    .from(agua)
    .where(and(eq(agua.userId, userId), eq(agua.data, data)))
    .orderBy(desc(agua.horario))
    .limit(100);
}

export async function totalAguaDoDia(userId: string, data: string): Promise<number> {
  return totalAgua(await listarAguaDoDia(userId, data));
}

export async function registrarAgua(userId: string, data: string, ml: number): Promise<void> {
  exigirId(userId);
  await db.insert(agua).values({ userId, data, ml });
}

/** Desfaz o último registro de água do dia. Retorna false se não houver nenhum. */
export async function desfazerUltimaAgua(userId: string, data: string): Promise<boolean> {
  exigirId(userId);
  const [ultimo] = await listarAguaDoDia(userId, data);
  if (!ultimo) return false;
  const linhas = await db
    .delete(agua)
    .where(and(eq(agua.id, ultimo.id), eq(agua.userId, userId)))
    .returning({ id: agua.id });
  return linhas.length === 1;
}

export async function apagarAgua(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const linhas = await db
    .delete(agua)
    .where(and(eq(agua.id, id), eq(agua.userId, userId)))
    .returning({ id: agua.id });
  return linhas.length === 1;
}
