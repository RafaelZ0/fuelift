// Relatório semanal (funções puras, sem banco). Semana de segunda a domingo. Tudo vem do que está no
// banco: nenhum número é inventado; ausência de dado fica como null e a tela explica.
import { ADAPTATIVO, KCAL_POR_KG, type DiaConsumo, type PesagemDia } from "./energia";
import { inicioDaSemana } from "./progresso-graficos";
import { diasEntre, tendenciaDoPeso } from "./treino";

export type EntradaRelatorio = {
  /** Segunda-feira da semana. */
  inicio: string;
  hoje: string;
  consumo: ReadonlyArray<DiaConsumo>;
  metaKcal: number | null;
  metaProteinaG: number | null;
  /** Pesagens recentes (inclusive antes da semana, para a tendência ter histórico). */
  pesagens: ReadonlyArray<PesagemDia>;
  sessoes: ReadonlyArray<{ data: string; status: string }>;
  treinosPlanejados: number | null;
  passos: ReadonlyArray<{ data: string; passos: number }>;
  gasto: { valor: number; minimo: number; maximo: number; metodo: string } | null;
};

export type RelatorioSemanal = {
  inicio: string;
  fim: string;
  /** A semana ainda não terminou: as médias consideram só os dias até hoje. */
  parcial: boolean;
  calorias: { media: number | null; dias: number; meta: number | null; difMedia: number | null };
  proteina: { media: number | null; meta: number | null; difMedia: number | null };
  treino: { feitos: number; faltas: number; planejados: number | null };
  peso: { inicioKg: number | null; fimKg: number | null; variacaoKg: number | null; pesagens: number };
  gasto: { valor: number; minimo: number; maximo: number; metodo: string } | null;
  /** O que a tendência do peso indicou (kg por semana, positivo = perdeu). */
  ritmoRealKgSemana: number | null;
  /** O que o consumo médio da semana prevê com o gasto estimado (kg por semana, positivo = perde). */
  ritmoPrevistoKgSemana: number | null;
  passos: { media: number | null; dias: number };
  avisos: string[];
};

const arred = (n: number, c = 1) => Math.round(n * 10 ** c) / 10 ** c;

export function fimDaSemana(inicio: string): string {
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function montarRelatorioSemanal(e: EntradaRelatorio): RelatorioSemanal {
  const fim = fimDaSemana(e.inicio);
  const ate = e.hoje < fim ? e.hoje : fim; // última data considerada
  const parcial = e.hoje < fim;
  const naSemana = <T extends { data: string }>(l: ReadonlyArray<T>) => l.filter((x) => x.data >= e.inicio && x.data <= ate);

  const completos = naSemana(e.consumo).filter((d) => d.kcal !== null && d.kcal >= ADAPTATIVO.kcalMinimaDoDia);
  const mediaKcal = completos.length ? Math.round(completos.reduce((s, d) => s + (d.kcal as number), 0) / completos.length) : null;
  const comProt = completos.filter((d) => d.proteinaG != null);
  const mediaProt = comProt.length ? Math.round(comProt.reduce((s, d) => s + (d.proteinaG as number), 0) / comProt.length) : null;

  const sessoes = naSemana(e.sessoes);
  const feitos = sessoes.filter((s) => s.status === "feito").length;
  const faltas = sessoes.filter((s) => s.status === "faltou").length;

  const tend = tendenciaDoPeso(e.pesagens.map((p) => ({ data: p.data, peso: p.peso })));
  const noFim = [...tend].filter((t) => t.data <= ate).at(-1) ?? null;
  const noInicio = [...tend].filter((t) => t.data < e.inicio).at(-1) ?? tend.find((t) => t.data >= e.inicio) ?? null;
  const nPesagens = naSemana(e.pesagens).length;
  let variacao: number | null = null;
  if (noFim && noInicio && noFim.data !== noInicio.data && nPesagens >= 2) variacao = arred(noFim.tendencia - noInicio.tendencia, 2);
  const diasVar = noFim && noInicio ? Math.max(1, diasEntre(noInicio.data, noFim.data)) : null;
  const ritmoReal = variacao !== null && diasVar !== null ? arred((-variacao * 7) / diasVar, 2) : null;

  const p = naSemana(e.passos);
  const mediaPassos = p.length ? Math.round(p.reduce((s, x) => s + x.passos, 0) / p.length) : null;

  const ritmoPrevisto = e.gasto && mediaKcal !== null ? arred(((e.gasto.valor - mediaKcal) * 7) / KCAL_POR_KG, 2) : null;

  const avisos: string[] = [];
  const diasPossiveis = diasEntre(e.inicio, ate) + 1;
  if (completos.length < Math.min(4, diasPossiveis)) avisos.push("Poucos dias com registro de comida: as médias podem não representar a semana.");
  if (nPesagens < 2) avisos.push("Poucas pesagens nesta semana: a variação do peso não pôde ser calculada.");
  if (parcial) avisos.push("A semana ainda não terminou: os números consideram só os dias até hoje.");

  return {
    inicio: e.inicio,
    fim,
    parcial,
    calorias: { media: mediaKcal, dias: completos.length, meta: e.metaKcal, difMedia: mediaKcal !== null && e.metaKcal !== null ? mediaKcal - e.metaKcal : null },
    proteina: { media: mediaProt, meta: e.metaProteinaG, difMedia: mediaProt !== null && e.metaProteinaG !== null ? mediaProt - e.metaProteinaG : null },
    treino: { feitos, faltas, planejados: e.treinosPlanejados },
    peso: { inicioKg: noInicio ? arred(noInicio.tendencia, 1) : null, fimKg: noFim ? arred(noFim.tendencia, 1) : null, variacaoKg: variacao, pesagens: nPesagens },
    gasto: e.gasto,
    ritmoRealKgSemana: ritmoReal,
    ritmoPrevistoKgSemana: ritmoPrevisto,
    passos: { media: mediaPassos, dias: p.length },
    avisos,
  };
}

/** Segunda-feira válida (AAAA-MM-DD, não futura); qualquer outra coisa vira a semana atual. */
export function semanaValida(valor: unknown, hoje: string): string {
  const atual = inicioDaSemana(hoje);
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return atual;
  if (Number.isNaN(Date.parse(`${valor}T00:00:00Z`))) return atual;
  if (valor < "2000-01-03" || valor > atual) return atual;
  return inicioDaSemana(valor) === valor ? valor : inicioDaSemana(valor);
}

export function semanaAnterior(inicio: string): string {
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function semanaSeguinte(inicio: string): string {
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** Texto fixo do app (sem IA): usado quando a IA não está disponível ou cita um número que o app não forneceu. */
export function resumoFixo(r: RelatorioSemanal): string {
  const n = (v: number) => v.toLocaleString("pt-BR");
  const partes: string[] = [];
  if (r.calorias.media !== null) {
    partes.push(
      `Você comeu em média ${n(r.calorias.media)} kcal por dia em ${r.calorias.dias} ${r.calorias.dias === 1 ? "dia com registro" : "dias com registro"}${
        r.calorias.meta !== null ? ` (meta ${n(r.calorias.meta)} kcal)` : ""
      }.`,
    );
  } else {
    partes.push("Não há dias com registro de comida suficientes nesta semana.");
  }
  if (r.proteina.media !== null) partes.push(`A proteína ficou em média em ${n(r.proteina.media)} g por dia${r.proteina.meta !== null ? ` (meta ${n(r.proteina.meta)} g)` : ""}.`);
  partes.push(`Treinos: ${r.treino.feitos} ${r.treino.feitos === 1 ? "feito" : "feitos"}${r.treino.faltas > 0 ? ` e ${r.treino.faltas} ${r.treino.faltas === 1 ? "falta" : "faltas"}` : ""}.`);
  if (r.peso.variacaoKg !== null) {
    const v = Math.abs(r.peso.variacaoKg).toLocaleString("pt-BR");
    partes.push(r.peso.variacaoKg < -0.05 ? `A tendência do peso caiu ${v} kg.` : r.peso.variacaoKg > 0.05 ? `A tendência do peso subiu ${v} kg.` : "A tendência do peso ficou estável.");
  }
  partes.push("São estimativas: o peso oscila por água e sal, então olhe a tendência de várias semanas.");
  return partes.join(" ");
}
