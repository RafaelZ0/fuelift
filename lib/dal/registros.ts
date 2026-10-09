import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrosAlimentares, type RegistroAlimentar } from "@/lib/db/schema";
import { arredondar, type Nutrientes } from "@/lib/nutricao";
import type { Refeicao, TipoAlimento } from "@/lib/validacao/comida";
import { ehUuid, exigirId } from "./util";

export async function listarDia(userId: string, data: string): Promise<RegistroAlimentar[]> {
  exigirId(userId);
  return db
    .select()
    .from(registrosAlimentares)
    .where(and(eq(registrosAlimentares.userId, userId), eq(registrosAlimentares.data, data)))
    .orderBy(asc(registrosAlimentares.criadoEm))
    .limit(300);
}

export async function obterRegistro(userId: string, id: string): Promise<RegistroAlimentar | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [r] = await db
    .select()
    .from(registrosAlimentares)
    .where(and(eq(registrosAlimentares.id, id), eq(registrosAlimentares.userId, userId)))
    .limit(1);
  return r ?? null;
}

export type NovoRegistro = {
  data: string;
  refeicao: Refeicao;
  tipo: TipoAlimento;
  alimentoId: string;
  nome: string;
  gramas: number;
  medidaTexto: string | null;
  nutrientes: Nutrientes;
  /** De onde veio o registro (padrão: manual). */
  origem?: "manual" | "codigo_barras";
};

/** Grava registros com os nutrientes já calculados (snapshot). Para alimento do usuário, o banco confere o dono. */
export async function criarRegistros(userId: string, novos: ReadonlyArray<NovoRegistro>): Promise<number> {
  exigirId(userId);
  if (novos.length === 0) return 0;
  const linhas = await db
    .insert(registrosAlimentares)
    .values(
      novos.map((n) => ({
        userId,
        data: n.data,
        refeicao: n.refeicao,
        alimentoBaseId: n.tipo === "base" ? n.alimentoId : null,
        alimentoUsuarioId: n.tipo === "usuario" ? n.alimentoId : null,
        nome: n.nome.slice(0, 160),
        gramas: n.gramas,
        medidaTexto: n.medidaTexto?.slice(0, 60) ?? null,
        origem: n.origem ?? "manual",
        ...n.nutrientes,
      })),
    )
    .returning({ id: registrosAlimentares.id });
  return linhas.length;
}

/**
 * Altera gramas e refeição de um registro do próprio usuário. Os nutrientes são
 * reescalados a partir do snapshot (mantém a base do momento do registro).
 */
export async function atualizarRegistro(
  userId: string,
  id: string,
  refeicao: Refeicao,
  novasGramas: number,
): Promise<boolean> {
  const atual = await obterRegistro(userId, id);
  if (!atual) return false;
  const fator = novasGramas / atual.gramas;
  const escalar = (v: number | null) => (v === null ? null : arredondar(v * fator, 2));
  const linhas = await db
    .update(registrosAlimentares)
    .set({
      refeicao,
      gramas: novasGramas,
      medidaTexto: novasGramas === atual.gramas ? atual.medidaTexto : null,
      kcal: arredondar(atual.kcal * fator, 2),
      proteinaG: escalar(atual.proteinaG),
      carboG: escalar(atual.carboG),
      gorduraG: escalar(atual.gorduraG),
      fibraG: escalar(atual.fibraG),
    })
    .where(and(eq(registrosAlimentares.id, id), eq(registrosAlimentares.userId, userId)))
    .returning({ id: registrosAlimentares.id });
  return linhas.length === 1;
}

export async function excluirRegistro(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const linhas = await db
    .delete(registrosAlimentares)
    .where(and(eq(registrosAlimentares.id, id), eq(registrosAlimentares.userId, userId)))
    .returning({ id: registrosAlimentares.id });
  return linhas.length === 1;
}

/** Itens de uma refeição de um dia (para copiar ou salvar), só os que ainda têm alimento ligado. */
export async function itensDaRefeicao(userId: string, data: string, refeicao: Refeicao) {
  exigirId(userId);
  const linhas = await db
    .select({
      alimentoBaseId: registrosAlimentares.alimentoBaseId,
      alimentoUsuarioId: registrosAlimentares.alimentoUsuarioId,
      gramas: registrosAlimentares.gramas,
      medidaTexto: registrosAlimentares.medidaTexto,
    })
    .from(registrosAlimentares)
    .where(
      and(
        eq(registrosAlimentares.userId, userId),
        eq(registrosAlimentares.data, data),
        eq(registrosAlimentares.refeicao, refeicao),
      ),
    )
    .orderBy(asc(registrosAlimentares.criadoEm))
    .limit(60);
  return linhas;
}
