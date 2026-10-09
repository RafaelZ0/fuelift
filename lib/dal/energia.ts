import "server-only";

import { and, between, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gastoEstimado, perfis, projecoesPeso, registrosAlimentares, type GastoEstimado } from "@/lib/db/schema";
import type { DiaConsumo, NivelAtividade, Sexo } from "@/lib/energia";
import { idadeEmAnos } from "@/lib/ia/prompts";
import { montarPainelEnergia, type PainelEnergia } from "@/lib/painel-energia";
import { somarDias } from "@/lib/datas";
import { listarPesagens } from "./corpo";
import { metaVigente } from "./metas";
import { obterPerfil } from "./perfil";
import { exigirId } from "./util";

/** Calorias somadas por dia (null nos dias sem registro). */
export async function consumoPorDia(userId: string, de: string, ate: string): Promise<DiaConsumo[]> {
  exigirId(userId);
  const linhas = await db
    .select({ data: registrosAlimentares.data, kcal: sql<string>`sum(${registrosAlimentares.kcal})`, proteinaG: sql<string | null>`sum(${registrosAlimentares.proteinaG})` })
    .from(registrosAlimentares)
    .where(and(eq(registrosAlimentares.userId, userId), between(registrosAlimentares.data, de, ate)))
    .groupBy(registrosAlimentares.data)
    .orderBy(registrosAlimentares.data);
  return linhas.map((l) => ({ data: l.data, kcal: l.kcal === null ? null : Number(l.kcal), proteinaG: l.proteinaG === null ? null : Number(l.proteinaG) }));
}

export type DadosEnergia = {
  painel: PainelEnergia;
  perfil: { sexo: Sexo | null; alturaCm: number | null; nivel: NivelAtividade | null; ritmoMaxPct: number };
  meta: Awaited<ReturnType<typeof metaVigente>>;
  consumo: DiaConsumo[];
  pesagens: Array<{ data: string; peso: number; massaMagraKg: number | null; cinturaCm: number | null }>;
};

/** Carrega tudo que o painel precisa (só dados do próprio usuário) e calcula. */
export async function carregarEnergia(userId: string, hoje: string, diasHistorico = 120): Promise<DadosEnergia> {
  exigirId(userId);
  const desde = somarDias(hoje, -diasHistorico);
  const [perfil, pesagensBd, consumo, meta] = await Promise.all([
    obterPerfil(userId),
    listarPesagens(userId, desde, 800),
    consumoPorDia(userId, desde, hoje),
    metaVigente(userId, hoje),
  ]);
  const pesagens = pesagensBd
    .map((p) => ({ data: p.data, peso: p.pesoKg, massaMagraKg: p.massaMagraKg ?? null, cinturaCm: p.cinturaCm ?? null }))
    .sort((a, b) => a.data.localeCompare(b.data));
  const entrada = {
    sexo: (perfil?.sexo as Sexo | null) ?? null,
    alturaCm: perfil?.alturaCm ?? null,
    nivel: (perfil?.nivelAtividade as NivelAtividade | null) ?? null,
    ritmoMaxPct: perfil?.ritmoMaxPct ?? 1,
  };
  const painel = montarPainelEnergia({
    hoje,
    perfil: { ...entrada, idadeAnos: idadeEmAnos(perfil?.dataNascimento ?? null, hoje) },
    pesagens,
    consumo,
    meta: meta ? { kcal: meta.kcal, pesoMetaKg: meta.pesoMetaKg, dataMeta: meta.dataMeta } : null,
  });
  return { painel, perfil: entrada, meta, consumo, pesagens };
}

// ─── Histórico do gasto estimado (uma linha por dia) ───

export async function guardarGastoDoDia(userId: string, hoje: string, g: { metodo: GastoEstimado["metodo"]; valor: number; minimo: number; maximo: number; diasUsados: number | null }): Promise<void> {
  exigirId(userId);
  await db
    .insert(gastoEstimado)
    .values({ userId, data: hoje, ...g })
    .onConflictDoUpdate({ target: [gastoEstimado.userId, gastoEstimado.data], set: g });
}

export async function historicoGasto(userId: string, desde: string): Promise<Array<{ data: string; valor: number }>> {
  exigirId(userId);
  const l = await db
    .select({ data: gastoEstimado.data, valor: gastoEstimado.valor })
    .from(gastoEstimado)
    .where(and(eq(gastoEstimado.userId, userId), between(gastoEstimado.data, desde, "9999-12-31")))
    .orderBy(gastoEstimado.data);
  return l;
}

// ─── Versões da projeção ───

export async function guardarProjecao(
  userId: string,
  p: { pesoInicialKg: number; pesoMetaKg: number; consumoKcal: number; gastoKcal: number; semanasParaMeta: number | null; pontos: Array<{ semana: number; peso: number }> },
): Promise<void> {
  exigirId(userId);
  // No máximo uma versão por dia: compara com a mais recente (mesmo dia e mesmos números = não repete).
  const [ultima] = await db.select().from(projecoesPeso).where(eq(projecoesPeso.userId, userId)).orderBy(desc(projecoesPeso.criadaEm)).limit(1);
  if (
    ultima &&
    Date.now() - ultima.criadaEm.getTime() < 86_400_000 &&
    ultima.pesoMetaKg === p.pesoMetaKg &&
    Math.abs(ultima.consumoKcal - p.consumoKcal) < 50 &&
    Math.abs(ultima.gastoKcal - p.gastoKcal) < 50
  ) {
    return;
  }
  await db.insert(projecoesPeso).values({ ...p, userId, pontos: p.pontos.slice(0, 105) });
}

export async function listarProjecoes(userId: string, limite = 12) {
  exigirId(userId);
  return db.select().from(projecoesPeso).where(eq(projecoesPeso.userId, userId)).orderBy(desc(projecoesPeso.criadaEm)).limit(limite);
}

// ─── Perfil: atividade e ritmo máximo ───

export async function definirNivelAtividade(userId: string, nivel: NivelAtividade): Promise<boolean> {
  exigirId(userId);
  const l = await db.update(perfis).set({ nivelAtividade: nivel, atualizadoEm: sql`now()` }).where(eq(perfis.userId, userId)).returning({ id: perfis.userId });
  return l.length === 1;
}

export async function definirRitmoMax(userId: string, pct: number): Promise<boolean> {
  exigirId(userId);
  const l = await db.update(perfis).set({ ritmoMaxPct: pct, atualizadoEm: sql`now()` }).where(eq(perfis.userId, userId)).returning({ id: perfis.userId });
  return l.length === 1;
}
