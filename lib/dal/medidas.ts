import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { favoritos, medidas, type Medida } from "@/lib/db/schema";
import type { TipoAlimento } from "@/lib/validacao/comida";
import { ehUuid, exigirId } from "./util";

const colunaDoTipo = (tipo: TipoAlimento) => (tipo === "base" ? medidas.alimentoBaseId : medidas.alimentoUsuarioId);

export async function listarMedidas(userId: string, tipo: TipoAlimento, alimentoId: string): Promise<Medida[]> {
  exigirId(userId);
  if (!ehUuid(alimentoId)) return [];
  return db
    .select()
    .from(medidas)
    .where(and(eq(medidas.userId, userId), eq(colunaDoTipo(tipo), alimentoId)))
    .orderBy(asc(medidas.gramas))
    .limit(30);
}

export async function obterMedida(userId: string, id: string): Promise<Medida | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [m] = await db.select().from(medidas).where(and(eq(medidas.id, id), eq(medidas.userId, userId))).limit(1);
  return m ?? null;
}

/**
 * Cria uma medida do usuário. Para alimento do usuário, o banco (FK por id + user_id)
 * recusa se o alimento for de outra pessoa.
 */
export async function criarMedida(
  userId: string,
  tipo: TipoAlimento,
  alimentoId: string,
  nome: string,
  gramas: number,
): Promise<"ok" | "duplicada"> {
  exigirId(userId);
  if (!ehUuid(alimentoId)) throw new Error("alimento inválido");
  const linhas = await db
    .insert(medidas)
    .values({
      userId,
      nome,
      gramas,
      alimentoBaseId: tipo === "base" ? alimentoId : null,
      alimentoUsuarioId: tipo === "usuario" ? alimentoId : null,
    })
    .onConflictDoNothing()
    .returning({ id: medidas.id });
  return linhas.length === 1 ? "ok" : "duplicada";
}

export async function excluirMedida(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const linhas = await db
    .delete(medidas)
    .where(and(eq(medidas.id, id), eq(medidas.userId, userId)))
    .returning({ id: medidas.id });
  return linhas.length === 1;
}

// ─── Favoritos ───

const colunaFavorito = (tipo: TipoAlimento) => (tipo === "base" ? favoritos.alimentoBaseId : favoritos.alimentoUsuarioId);

export async function ehFavorito(userId: string, tipo: TipoAlimento, alimentoId: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(alimentoId)) return false;
  const [f] = await db
    .select({ id: favoritos.id })
    .from(favoritos)
    .where(and(eq(favoritos.userId, userId), eq(colunaFavorito(tipo), alimentoId)))
    .limit(1);
  return Boolean(f);
}

/** Liga/desliga o favorito. Retorna o novo estado. */
export async function alternarFavorito(userId: string, tipo: TipoAlimento, alimentoId: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(alimentoId)) throw new Error("alimento inválido");
  const apagados = await db
    .delete(favoritos)
    .where(and(eq(favoritos.userId, userId), eq(colunaFavorito(tipo), alimentoId)))
    .returning({ id: favoritos.id });
  if (apagados.length > 0) return false;
  await db
    .insert(favoritos)
    .values({
      userId,
      alimentoBaseId: tipo === "base" ? alimentoId : null,
      alimentoUsuarioId: tipo === "usuario" ? alimentoId : null,
    })
    .onConflictDoNothing();
  return true;
}
