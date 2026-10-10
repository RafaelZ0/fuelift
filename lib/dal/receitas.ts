import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { alimentosUsuario, medidas, receitaItens, receitas, type Receita, type ReceitaItem } from "@/lib/db/schema";
import { normalizarBusca } from "@/lib/busca";
import type { NutrientesIngrediente, Totais } from "@/lib/receita";
import { ehUuid, exigirId } from "./util";

export type ItemParaGravar = {
  tipo: "base" | "usuario";
  alimentoId: string;
  nome: string;
  gramas: number;
  nutrientes: NutrientesIngrediente;
};

export type ReceitaParaGravar = {
  nome: string;
  porcoes: number;
  pesoFinalG: number;
  itens: ItemParaGravar[];
  por100g: Totais;
  gramasPorcao: number;
};

export const NOME_MEDIDA_PORCAO = "porção";

export async function listarReceitas(userId: string): Promise<Array<Receita & { kcalPor100g: number | null }>> {
  exigirId(userId);
  const l = await db
    .select({ r: receitas, kcal: alimentosUsuario.kcal })
    .from(receitas)
    .leftJoin(alimentosUsuario, and(eq(alimentosUsuario.id, receitas.alimentoUsuarioId), eq(alimentosUsuario.userId, receitas.userId)))
    .where(eq(receitas.userId, userId))
    .orderBy(desc(receitas.atualizadoEm))
    .limit(200);
  return l.map((x) => ({ ...x.r, kcalPor100g: x.kcal }));
}

export async function obterReceita(userId: string, id: string): Promise<{ receita: Receita; itens: ReceitaItem[] } | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [receita] = await db.select().from(receitas).where(and(eq(receitas.id, id), eq(receitas.userId, userId))).limit(1);
  if (!receita) return null;
  const itens = await db.select().from(receitaItens).where(and(eq(receitaItens.receitaId, id), eq(receitaItens.userId, userId))).orderBy(asc(receitaItens.ordem));
  return { receita, itens };
}

/**
 * Grava a receita, o alimento do usuário gerado a partir dela e a medida "porção", tudo num único lote
 * (tudo ou nada). O banco confere (chaves compostas) que tudo pertence ao usuário.
 */
export async function gravarReceita(userId: string, dados: ReceitaParaGravar, receitaId: string | null): Promise<string> {
  exigirId(userId);
  const atual = receitaId ? await obterReceita(userId, receitaId) : null;
  if (receitaId && !atual) throw new Error("receita não encontrada");

  const id = atual?.receita.id ?? crypto.randomUUID();
  const alimentoExistente = atual?.receita.alimentoUsuarioId ?? null;
  const alimentoId = alimentoExistente ?? crypto.randomUUID();
  const nomeBusca = normalizarBusca(dados.nome);
  const agora = new Date();
  const valoresAlimento = {
    nome: dados.nome,
    nomeBusca,
    marca: null,
    kcal: dados.por100g.kcal,
    proteinaG: dados.por100g.proteinaG,
    carboG: dados.por100g.carboG,
    gorduraG: dados.por100g.gorduraG,
    fibraG: dados.por100g.fibraG,
    sodioMg: null,
    origem: "receita" as const,
  };
  const linhasItens = dados.itens.map((i, ordem) => ({
    userId,
    receitaId: id,
    ordem,
    alimentoBaseId: i.tipo === "base" ? i.alimentoId : null,
    alimentoUsuarioId: i.tipo === "usuario" ? i.alimentoId : null,
    nome: i.nome.slice(0, 160),
    gramas: i.gramas,
    kcal: i.nutrientes.kcal,
    proteinaG: i.nutrientes.proteinaG,
    carboG: i.nutrientes.carboG,
    gorduraG: i.nutrientes.gorduraG,
    fibraG: i.nutrientes.fibraG,
  }));
  const medidaPorcao = { userId, alimentoUsuarioId: alimentoId, nome: NOME_MEDIDA_PORCAO, gramas: dados.gramasPorcao, origem: "usuario" as const };

  if (!atual) {
    await db.batch([
      db.insert(alimentosUsuario).values({ ...valoresAlimento, id: alimentoId, userId }),
      db.insert(receitas).values({ id, userId, nome: dados.nome, porcoes: dados.porcoes, pesoFinalG: dados.pesoFinalG, alimentoUsuarioId: alimentoId }),
      db.insert(receitaItens).values(linhasItens),
      db.insert(medidas).values(medidaPorcao),
    ]);
  } else {
    const alimentoOp = alimentoExistente
      ? db.update(alimentosUsuario).set({ ...valoresAlimento, atualizadoEm: agora }).where(and(eq(alimentosUsuario.id, alimentoId), eq(alimentosUsuario.userId, userId)))
      : db.insert(alimentosUsuario).values({ ...valoresAlimento, id: alimentoId, userId });
    await db.batch([
      alimentoOp,
      db.update(receitas).set({ nome: dados.nome, porcoes: dados.porcoes, pesoFinalG: dados.pesoFinalG, alimentoUsuarioId: alimentoId, atualizadoEm: agora }).where(and(eq(receitas.id, id), eq(receitas.userId, userId))),
      db.delete(receitaItens).where(and(eq(receitaItens.receitaId, id), eq(receitaItens.userId, userId))),
      db.insert(receitaItens).values(linhasItens),
      db.delete(medidas).where(and(eq(medidas.userId, userId), eq(medidas.alimentoUsuarioId, alimentoId), eq(medidas.nome, NOME_MEDIDA_PORCAO))),
      db.insert(medidas).values(medidaPorcao),
    ]);
  }
  return id;
}

/** Apaga a receita e o alimento gerado (registros antigos ficam, com o snapshot dos nutrientes). */
export async function excluirReceita(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  const atual = await obterReceita(userId, id);
  if (!atual) return false;
  await db.batch([
    db.delete(receitas).where(and(eq(receitas.id, id), eq(receitas.userId, userId))),
    ...(atual.receita.alimentoUsuarioId ? [db.delete(alimentosUsuario).where(and(eq(alimentosUsuario.id, atual.receita.alimentoUsuarioId), eq(alimentosUsuario.userId, userId)))] : []),
  ]);
  return true;
}
