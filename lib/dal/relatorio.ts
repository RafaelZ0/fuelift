import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { relatoriosSemanais } from "@/lib/db/schema";
import { somarDias } from "@/lib/datas";
import { hashDoRelatorio } from "@/lib/ia/relatorio";
import { fimDaSemana, montarRelatorioSemanal, type RelatorioSemanal } from "@/lib/relatorio";
import { listarPesagens } from "./corpo";
import { carregarEnergia, consumoPorDia } from "./energia";
import { metaVigente } from "./metas";
import { passosDoPeriodo } from "./passos";
import { listarSessoes, obterAgenda } from "./treino";
import { exigirId } from "./util";

export type RelatorioCompleto = { relatorio: RelatorioSemanal; textoIa: string | null };

/**
 * Calcula o relatório da semana com os dados do próprio usuário, guarda o resumo (um por semana) e devolve
 * o texto da IA só se ele foi escrito com exatamente estes números.
 */
export async function carregarRelatorio(userId: string, inicio: string, hoje: string): Promise<RelatorioCompleto> {
  exigirId(userId);
  const fim = fimDaSemana(inicio);
  const ate = hoje < fim ? hoje : fim;
  const [consumo, pesagensBd, sessoes, agenda, passos, meta, energia] = await Promise.all([
    consumoPorDia(userId, inicio, fim),
    listarPesagens(userId, somarDias(inicio, -60), 400),
    listarSessoes(userId, inicio, fim),
    obterAgenda(userId),
    passosDoPeriodo(userId, inicio, fim),
    metaVigente(userId, ate),
    carregarEnergia(userId, ate, 60),
  ]);
  const g = energia.painel.gasto;
  const relatorio = montarRelatorioSemanal({
    inicio,
    hoje,
    consumo,
    metaKcal: meta?.kcal ?? null,
    metaProteinaG: meta?.proteinaG ?? null,
    pesagens: pesagensBd.map((p) => ({ data: p.data, peso: p.pesoKg })),
    sessoes: sessoes.map((s) => ({ data: s.data, status: s.status })),
    treinosPlanejados: agenda.size > 0 ? agenda.size : null,
    passos,
    gasto: g ? { valor: g.valor, minimo: g.minimo, maximo: g.maximo, metodo: g.metodo } : null,
  });

  const [guardado] = await db
    .select({ textoIa: relatoriosSemanais.textoIa, textoHash: relatoriosSemanais.textoHash })
    .from(relatoriosSemanais)
    .where(and(eq(relatoriosSemanais.userId, userId), eq(relatoriosSemanais.inicio, inicio)))
    .limit(1);
  await db
    .insert(relatoriosSemanais)
    .values({ userId, inicio, dados: relatorio as unknown as Record<string, unknown> })
    .onConflictDoUpdate({ target: [relatoriosSemanais.userId, relatoriosSemanais.inicio], set: { dados: relatorio as unknown as Record<string, unknown>, atualizadoEm: new Date() } });

  const textoIa = guardado?.textoIa && guardado.textoHash === hashDoRelatorio(relatorio) ? guardado.textoIa : null;
  return { relatorio, textoIa };
}

/** Guarda o texto da IA ligado aos números usados. */
export async function guardarTextoIa(userId: string, inicio: string, texto: string, relatorio: RelatorioSemanal): Promise<void> {
  exigirId(userId);
  await db
    .update(relatoriosSemanais)
    .set({ textoIa: texto.slice(0, 2000), textoHash: hashDoRelatorio(relatorio), atualizadoEm: new Date() })
    .where(and(eq(relatoriosSemanais.userId, userId), eq(relatoriosSemanais.inicio, inicio)));
}
