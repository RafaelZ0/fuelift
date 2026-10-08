import "server-only";

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agendaTreino,
  exercicios,
  planosTreino,
  seriesTreino,
  sessoesTreino,
  treinoExercicios,
  treinoSubstitutos,
  treinos,
  trocasTreino,
  type Exercicio,
  type PlanoTreino,
  type SessaoTreino,
  type Treino,
} from "@/lib/db/schema";
import type { SerieFeita } from "@/lib/treino";
import { ehUuid, exigirId } from "./util";

// ─── Exercícios ───

export type DadosExercicio = {
  nome: string;
  grupo: string | null;
  unilateral: boolean;
  cargaPorHalter: boolean;
  medida: "repeticoes" | "segundos";
  fotoId: string | null;
};

export async function listarExercicios(userId: string): Promise<Exercicio[]> {
  exigirId(userId);
  return db.select().from(exercicios).where(eq(exercicios.userId, userId)).orderBy(asc(exercicios.nome)).limit(500);
}

export async function obterExercicio(userId: string, id: string): Promise<Exercicio | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [e] = await db.select().from(exercicios).where(and(eq(exercicios.id, id), eq(exercicios.userId, userId))).limit(1);
  return e ?? null;
}

export async function criarExercicio(userId: string, dados: DadosExercicio): Promise<string> {
  exigirId(userId);
  const [e] = await db.insert(exercicios).values({ ...dados, userId }).returning({ id: exercicios.id });
  return e.id;
}

export async function atualizarExercicio(userId: string, id: string, dados: DadosExercicio): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const l = await db
    .update(exercicios)
    .set(dados)
    .where(and(eq(exercicios.id, id), eq(exercicios.userId, userId)))
    .returning({ id: exercicios.id });
  return l.length === 1;
}

/** Apaga o exercício e, em cascata, suas séries e o uso nos treinos. */
export async function excluirExercicio(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const l = await db
    .delete(exercicios)
    .where(and(eq(exercicios.id, id), eq(exercicios.userId, userId)))
    .returning({ id: exercicios.id });
  return l.length === 1;
}

// ─── Plano ───

export type DadosPlano = {
  nome: string;
  inicio: string;
  seriesInicio: number;
  seriesDepois: number;
  semanasInicio: number;
};

export async function planoAtivo(userId: string): Promise<PlanoTreino | null> {
  exigirId(userId);
  const [p] = await db
    .select()
    .from(planosTreino)
    .where(and(eq(planosTreino.userId, userId), eq(planosTreino.ativo, true)))
    .limit(1);
  return p ?? null;
}

/** Cria um plano e o torna o ativo (o anterior fica guardado como inativo). */
export async function criarPlano(userId: string, dados: DadosPlano): Promise<string> {
  exigirId(userId);
  const id = crypto.randomUUID();
  await db.batch([
    db.update(planosTreino).set({ ativo: false }).where(and(eq(planosTreino.userId, userId), eq(planosTreino.ativo, true))),
    db.delete(agendaTreino).where(eq(agendaTreino.userId, userId)),
    db.insert(planosTreino).values({ id, userId, ...dados, ativo: true }),
  ]);
  return id;
}

export async function atualizarPlano(userId: string, id: string, dados: DadosPlano): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const l = await db
    .update(planosTreino)
    .set(dados)
    .where(and(eq(planosTreino.id, id), eq(planosTreino.userId, userId)))
    .returning({ id: planosTreino.id });
  return l.length === 1;
}

// ─── Treinos do plano ───

export async function listarTreinos(userId: string, planoId: string): Promise<Treino[]> {
  exigirId(userId);
  if (!ehUuid(planoId)) return [];
  return db
    .select()
    .from(treinos)
    .where(and(eq(treinos.userId, userId), eq(treinos.planoId, planoId)))
    .orderBy(asc(treinos.ordem))
    .limit(30);
}

export async function obterTreino(userId: string, id: string): Promise<Treino | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [t] = await db.select().from(treinos).where(and(eq(treinos.id, id), eq(treinos.userId, userId))).limit(1);
  return t ?? null;
}

export async function criarTreino(userId: string, planoId: string, nome: string, foco: string | null): Promise<string> {
  exigirId(userId);
  const [{ proxima }] = await db
    .select({ proxima: sql<number>`coalesce(max(${treinos.ordem}), -1) + 1` })
    .from(treinos)
    .where(and(eq(treinos.userId, userId), eq(treinos.planoId, planoId)));
  const [t] = await db.insert(treinos).values({ userId, planoId, ordem: proxima, nome, foco }).returning({ id: treinos.id });
  return t.id;
}

export async function atualizarTreino(userId: string, id: string, nome: string, foco: string | null): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const l = await db
    .update(treinos)
    .set({ nome, foco })
    .where(and(eq(treinos.id, id), eq(treinos.userId, userId)))
    .returning({ id: treinos.id });
  return l.length === 1;
}

/** Apaga o treino (e seus exercícios). As sessões já feitas ficam no histórico, sem o vínculo. */
export async function excluirTreino(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const l = await db
    .delete(treinos)
    .where(and(eq(treinos.id, id), eq(treinos.userId, userId)))
    .returning({ id: treinos.id });
  return l.length === 1;
}

// ─── Exercícios do treino ───

export type ItemDoTreino = {
  id: string;
  ordem: number;
  series: number | null;
  repsMin: number;
  repsMax: number;
  descansoS: number;
  observacao: string | null;
  exercicio: Pick<Exercicio, "id" | "nome" | "grupo" | "unilateral" | "cargaPorHalter" | "medida" | "fotoId">;
  substitutos: Array<Pick<Exercicio, "id" | "nome" | "unilateral" | "cargaPorHalter" | "medida" | "fotoId">>;
};

export async function listarItensDoTreino(userId: string, treinoId: string): Promise<ItemDoTreino[]> {
  exigirId(userId);
  if (!ehUuid(treinoId)) return [];
  const itens = await db
    .select({
      id: treinoExercicios.id,
      ordem: treinoExercicios.ordem,
      series: treinoExercicios.series,
      repsMin: treinoExercicios.repsMin,
      repsMax: treinoExercicios.repsMax,
      descansoS: treinoExercicios.descansoS,
      observacao: treinoExercicios.observacao,
      exId: exercicios.id,
      exNome: exercicios.nome,
      exGrupo: exercicios.grupo,
      exUnilateral: exercicios.unilateral,
      exHalter: exercicios.cargaPorHalter,
      exMedida: exercicios.medida,
      exFoto: exercicios.fotoId,
    })
    .from(treinoExercicios)
    .innerJoin(exercicios, and(eq(exercicios.id, treinoExercicios.exercicioId), eq(exercicios.userId, treinoExercicios.userId)))
    .where(and(eq(treinoExercicios.userId, userId), eq(treinoExercicios.treinoId, treinoId)))
    .orderBy(asc(treinoExercicios.ordem))
    .limit(60);
  if (itens.length === 0) return [];

  const subs = await db
    .select({
      itemId: treinoSubstitutos.treinoExercicioId,
      id: exercicios.id,
      nome: exercicios.nome,
      unilateral: exercicios.unilateral,
      cargaPorHalter: exercicios.cargaPorHalter,
      medida: exercicios.medida,
      fotoId: exercicios.fotoId,
    })
    .from(treinoSubstitutos)
    .innerJoin(exercicios, and(eq(exercicios.id, treinoSubstitutos.exercicioId), eq(exercicios.userId, treinoSubstitutos.userId)))
    .where(eq(treinoSubstitutos.userId, userId))
    .limit(500);

  return itens.map((i) => ({
    id: i.id,
    ordem: i.ordem,
    series: i.series,
    repsMin: i.repsMin,
    repsMax: i.repsMax,
    descansoS: i.descansoS,
    observacao: i.observacao,
    exercicio: {
      id: i.exId,
      nome: i.exNome,
      grupo: i.exGrupo,
      unilateral: i.exUnilateral,
      cargaPorHalter: i.exHalter,
      medida: i.exMedida,
      fotoId: i.exFoto,
    },
    substitutos: subs
      .filter((s) => s.itemId === i.id)
      .map((s) => ({ id: s.id, nome: s.nome, unilateral: s.unilateral, cargaPorHalter: s.cargaPorHalter, medida: s.medida, fotoId: s.fotoId })),
  }));
}

export type DadosItem = {
  treinoId: string;
  exercicioId: string;
  series: number | null;
  repsMin: number;
  repsMax: number;
  descansoS: number;
  observacao: string | null;
};

/** O banco garante (FK por id + user_id) que treino e exercício são do mesmo usuário. */
export async function adicionarItem(userId: string, dados: DadosItem): Promise<string> {
  exigirId(userId);
  const [{ proxima }] = await db
    .select({ proxima: sql<number>`coalesce(max(${treinoExercicios.ordem}), -1) + 1` })
    .from(treinoExercicios)
    .where(and(eq(treinoExercicios.userId, userId), eq(treinoExercicios.treinoId, dados.treinoId)));
  const [i] = await db
    .insert(treinoExercicios)
    .values({ userId, ...dados, ordem: proxima })
    .returning({ id: treinoExercicios.id });
  return i.id;
}

export async function removerItem(userId: string, itemId: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(itemId)) return false;
  const l = await db
    .delete(treinoExercicios)
    .where(and(eq(treinoExercicios.id, itemId), eq(treinoExercicios.userId, userId)))
    .returning({ id: treinoExercicios.id });
  return l.length === 1;
}

export async function adicionarSubstituto(userId: string, itemId: string, exercicioId: string): Promise<void> {
  exigirId(userId);
  await db.insert(treinoSubstitutos).values({ userId, treinoExercicioId: itemId, exercicioId }).onConflictDoNothing();
}

export async function removerSubstituto(userId: string, itemId: string, exercicioId: string): Promise<void> {
  exigirId(userId);
  await db
    .delete(treinoSubstitutos)
    .where(
      and(
        eq(treinoSubstitutos.userId, userId),
        eq(treinoSubstitutos.treinoExercicioId, itemId),
        eq(treinoSubstitutos.exercicioId, exercicioId),
      ),
    );
}

// ─── Agenda e trocas ───

export async function obterAgenda(userId: string): Promise<Map<number, string>> {
  exigirId(userId);
  const l = await db.select({ dia: agendaTreino.diaSemana, treinoId: agendaTreino.treinoId }).from(agendaTreino).where(eq(agendaTreino.userId, userId));
  return new Map(l.map((x) => [x.dia, x.treinoId]));
}

export async function definirAgenda(userId: string, dia: number, treinoId: string | null): Promise<void> {
  exigirId(userId);
  if (treinoId === null) {
    await db.delete(agendaTreino).where(and(eq(agendaTreino.userId, userId), eq(agendaTreino.diaSemana, dia)));
    return;
  }
  await db
    .insert(agendaTreino)
    .values({ userId, diaSemana: dia, treinoId })
    .onConflictDoUpdate({ target: [agendaTreino.userId, agendaTreino.diaSemana], set: { treinoId } });
}

export async function obterTrocas(userId: string, de: string, ate: string): Promise<Map<string, string | null>> {
  exigirId(userId);
  const l = await db
    .select({ data: trocasTreino.data, treinoId: trocasTreino.treinoId })
    .from(trocasTreino)
    .where(and(eq(trocasTreino.userId, userId), gte(trocasTreino.data, de), lte(trocasTreino.data, ate)));
  return new Map(l.map((x) => [x.data, x.treinoId]));
}

/** treinoId nulo = dia de descanso. Para voltar ao da agenda, use removerTroca. */
export async function definirTroca(userId: string, data: string, treinoId: string | null): Promise<void> {
  exigirId(userId);
  await db
    .insert(trocasTreino)
    .values({ userId, data, treinoId })
    .onConflictDoUpdate({ target: [trocasTreino.userId, trocasTreino.data], set: { treinoId } });
}

export async function removerTroca(userId: string, data: string): Promise<void> {
  exigirId(userId);
  await db.delete(trocasTreino).where(and(eq(trocasTreino.userId, userId), eq(trocasTreino.data, data)));
}

// ─── Sessões e séries ───

export async function obterSessao(userId: string, data: string): Promise<SessaoTreino | null> {
  exigirId(userId);
  const [s] = await db.select().from(sessoesTreino).where(and(eq(sessoesTreino.userId, userId), eq(sessoesTreino.data, data))).limit(1);
  return s ?? null;
}

export async function listarSessoes(userId: string, de: string, ate: string): Promise<SessaoTreino[]> {
  exigirId(userId);
  return db
    .select()
    .from(sessoesTreino)
    .where(and(eq(sessoesTreino.userId, userId), gte(sessoesTreino.data, de), lte(sessoesTreino.data, ate)))
    .orderBy(desc(sessoesTreino.data))
    .limit(400);
}

/** Últimas sessões, para a sequência atual. */
export async function ultimasSessoes(userId: string, limite = 60): Promise<SessaoTreino[]> {
  exigirId(userId);
  return db.select().from(sessoesTreino).where(eq(sessoesTreino.userId, userId)).orderBy(desc(sessoesTreino.data)).limit(limite);
}

/** Garante a sessão do dia como "feito" (registrar uma série conta como treinar). */
async function garantirSessaoFeita(userId: string, data: string, treinoId: string | null): Promise<string> {
  const [s] = await db
    .insert(sessoesTreino)
    .values({ userId, data, treinoId, status: "feito", motivo: null })
    .onConflictDoUpdate({
      target: [sessoesTreino.userId, sessoesTreino.data],
      set: { status: "feito", motivo: null, treinoId: sql`coalesce(${treinoId}, ${sessoesTreino.treinoId})` },
    })
    .returning({ id: sessoesTreino.id });
  return s.id;
}

export type DadosSerie = {
  data: string;
  treinoId: string | null;
  exercicioId: string;
  numero: number;
  cargaKg: number;
  repeticoes: number | null;
  segundos: number | null;
  feito: boolean;
};

/** Salva (ou corrige) uma série. O banco confere que o exercício é do mesmo usuário. */
export async function salvarSerie(userId: string, d: DadosSerie): Promise<void> {
  exigirId(userId);
  const sessaoId = await garantirSessaoFeita(userId, d.data, d.treinoId);
  const valores = { cargaKg: d.cargaKg, repeticoes: d.repeticoes, segundos: d.segundos, feito: d.feito };
  await db
    .insert(seriesTreino)
    .values({ userId, sessaoId, exercicioId: d.exercicioId, numero: d.numero, ...valores })
    .onConflictDoUpdate({ target: [seriesTreino.sessaoId, seriesTreino.exercicioId, seriesTreino.numero], set: valores });
}

export async function apagarSerie(userId: string, data: string, exercicioId: string, numero: number): Promise<boolean> {
  exigirId(userId);
  const s = await obterSessao(userId, data);
  if (!s) return false;
  const l = await db
    .delete(seriesTreino)
    .where(
      and(
        eq(seriesTreino.userId, userId),
        eq(seriesTreino.sessaoId, s.id),
        eq(seriesTreino.exercicioId, exercicioId),
        eq(seriesTreino.numero, numero),
      ),
    )
    .returning({ id: seriesTreino.id });
  return l.length === 1;
}

export async function listarSeriesDoDia(userId: string, data: string) {
  exigirId(userId);
  const s = await obterSessao(userId, data);
  if (!s) return [];
  return db
    .select({
      exercicioId: seriesTreino.exercicioId,
      numero: seriesTreino.numero,
      cargaKg: seriesTreino.cargaKg,
      repeticoes: seriesTreino.repeticoes,
      segundos: seriesTreino.segundos,
      feito: seriesTreino.feito,
    })
    .from(seriesTreino)
    .where(and(eq(seriesTreino.userId, userId), eq(seriesTreino.sessaoId, s.id)))
    .orderBy(asc(seriesTreino.exercicioId), asc(seriesTreino.numero))
    .limit(600);
}

export async function registrarFalta(userId: string, data: string, treinoId: string | null, motivo: string, observacao: string | null): Promise<void> {
  exigirId(userId);
  await db
    .insert(sessoesTreino)
    .values({ userId, data, treinoId, status: "faltou", motivo, observacao })
    .onConflictDoUpdate({
      target: [sessoesTreino.userId, sessoesTreino.data],
      set: { status: "faltou", motivo, observacao, treinoId },
    });
}

export async function salvarObservacaoDaSessao(userId: string, data: string, treinoId: string | null, observacao: string | null): Promise<void> {
  exigirId(userId);
  const id = await garantirSessaoFeita(userId, data, treinoId);
  await db.update(sessoesTreino).set({ observacao }).where(and(eq(sessoesTreino.id, id), eq(sessoesTreino.userId, userId)));
}

/** Desfaz o registro do dia (apaga a sessão e suas séries). */
export async function apagarSessao(userId: string, data: string): Promise<boolean> {
  exigirId(userId);
  const l = await db
    .delete(sessoesTreino)
    .where(and(eq(sessoesTreino.userId, userId), eq(sessoesTreino.data, data)))
    .returning({ id: sessoesTreino.id });
  return l.length === 1;
}

/** Séries da última sessão (antes de `antesDe`) em que o exercício foi feito, para a dica de progressão. */
export async function ultimaSessaoDoExercicio(userId: string, exercicioId: string, antesDe: string): Promise<SerieFeita[]> {
  exigirId(userId);
  if (!ehUuid(exercicioId)) return [];
  const [ultima] = await db
    .select({ sessaoId: seriesTreino.sessaoId, data: sessoesTreino.data })
    .from(seriesTreino)
    .innerJoin(sessoesTreino, and(eq(sessoesTreino.id, seriesTreino.sessaoId), eq(sessoesTreino.userId, seriesTreino.userId)))
    .where(and(eq(seriesTreino.userId, userId), eq(seriesTreino.exercicioId, exercicioId), sql`${sessoesTreino.data} < ${antesDe}`))
    .orderBy(desc(sessoesTreino.data))
    .limit(1);
  if (!ultima) return [];
  return db
    .select({
      numero: seriesTreino.numero,
      cargaKg: seriesTreino.cargaKg,
      repeticoes: seriesTreino.repeticoes,
      segundos: seriesTreino.segundos,
      feito: seriesTreino.feito,
    })
    .from(seriesTreino)
    .where(and(eq(seriesTreino.userId, userId), eq(seriesTreino.sessaoId, ultima.sessaoId), eq(seriesTreino.exercicioId, exercicioId)))
    .orderBy(asc(seriesTreino.numero))
    .limit(30);
}

/** Maior carga por sessão do exercício (mais antigas primeiro), para o gráfico de evolução. */
export async function evolucaoDoExercicio(userId: string, exercicioId: string, limite = 60) {
  exigirId(userId);
  if (!ehUuid(exercicioId)) return [];
  const l = await db
    .select({
      data: sessoesTreino.data,
      cargaMax: sql<number>`max(${seriesTreino.cargaKg})::float`,
      series: sql<number>`count(*)::int`,
    })
    .from(seriesTreino)
    .innerJoin(sessoesTreino, and(eq(sessoesTreino.id, seriesTreino.sessaoId), eq(sessoesTreino.userId, seriesTreino.userId)))
    .where(and(eq(seriesTreino.userId, userId), eq(seriesTreino.exercicioId, exercicioId), eq(seriesTreino.feito, true)))
    .groupBy(sessoesTreino.data)
    .orderBy(desc(sessoesTreino.data))
    .limit(limite);
  return l.reverse();
}
