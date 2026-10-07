import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { refeicoesSalvas, refeicoesSalvasItens } from "@/lib/db/schema";
import { ehUuid, exigirId } from "./util";

export const ITENS_MAX = 30;

export type ItemSalvo = {
  alimentoBaseId: string | null;
  alimentoUsuarioId: string | null;
  gramas: number;
  medidaTexto: string | null;
};

export async function listarRefeicoesSalvas(userId: string) {
  exigirId(userId);
  return db
    .select({
      id: refeicoesSalvas.id,
      nome: refeicoesSalvas.nome,
      // Coluna qualificada à mão: dentro do select o Drizzle não prefixa a tabela.
      itens: sql<number>`(select count(*)::int from refeicoes_salvas_itens i where i.refeicao_salva_id = "refeicoes_salvas"."id" and i.user_id = ${userId})`,
    })
    .from(refeicoesSalvas)
    .where(eq(refeicoesSalvas.userId, userId))
    .orderBy(desc(refeicoesSalvas.criadoEm))
    .limit(100);
}

export async function itensDaRefeicaoSalva(userId: string, id: string): Promise<ItemSalvo[] | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [dona] = await db
    .select({ id: refeicoesSalvas.id })
    .from(refeicoesSalvas)
    .where(and(eq(refeicoesSalvas.id, id), eq(refeicoesSalvas.userId, userId)))
    .limit(1);
  if (!dona) return null;
  return db
    .select({
      alimentoBaseId: refeicoesSalvasItens.alimentoBaseId,
      alimentoUsuarioId: refeicoesSalvasItens.alimentoUsuarioId,
      gramas: refeicoesSalvasItens.gramas,
      medidaTexto: refeicoesSalvasItens.medidaTexto,
    })
    .from(refeicoesSalvasItens)
    .where(and(eq(refeicoesSalvasItens.refeicaoSalvaId, id), eq(refeicoesSalvasItens.userId, userId)))
    .orderBy(asc(refeicoesSalvasItens.ordem))
    .limit(ITENS_MAX);
}

/**
 * Cria a refeição salva e os itens numa transação. As FKs por (id, user_id)
 * garantem no banco que itens e alimentos são do mesmo usuário.
 */
export async function criarRefeicaoSalva(userId: string, nome: string, itens: ReadonlyArray<ItemSalvo>): Promise<string> {
  exigirId(userId);
  if (itens.length === 0 || itens.length > ITENS_MAX) throw new Error("quantidade de itens inválida");
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(refeicoesSalvas).values({ id, userId, nome }),
    db.insert(refeicoesSalvasItens).values(
      itens.map((it, ordem) => ({
        refeicaoSalvaId: id,
        userId,
        alimentoBaseId: it.alimentoBaseId,
        alimentoUsuarioId: it.alimentoUsuarioId,
        gramas: it.gramas,
        medidaTexto: it.medidaTexto,
        ordem,
      })),
    ),
  ]);
  return id;
}

export async function excluirRefeicaoSalva(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const linhas = await db
    .delete(refeicoesSalvas)
    .where(and(eq(refeicoesSalvas.id, id), eq(refeicoesSalvas.userId, userId)))
    .returning({ id: refeicoesSalvas.id });
  return linhas.length === 1;
}
