// Agregações dos gráficos de progresso (funções puras). Os componentes só desenham o que sai daqui.
import { diasEntre } from "./treino";

/** Segunda-feira da semana da data (AAAA-MM-DD). */
export function inicioDaSemana(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type DiaValor = { data: string; valor: number | null };
export type SemanaMedia = { inicio: string; media: number; dias: number };

/** Média por semana considerando só os dias com valor. Semanas sem nenhum valor não aparecem. */
export function mediaPorSemana(dias: ReadonlyArray<DiaValor>): SemanaMedia[] {
  const mapa = new Map<string, { soma: number; n: number }>();
  for (const d of dias) {
    if (d.valor === null) continue;
    const k = inicioDaSemana(d.data);
    const a = mapa.get(k) ?? { soma: 0, n: 0 };
    a.soma += d.valor;
    a.n++;
    mapa.set(k, a);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([inicio, a]) => ({ inicio, media: Math.round(a.soma / a.n), dias: a.n }));
}

/** Quantos treinos feitos em cada semana (semanas sem treino entram com 0, entre a primeira e a última). */
export function treinosPorSemana(datasFeitas: ReadonlyArray<string>): Array<{ inicio: string; total: number }> {
  if (datasFeitas.length === 0) return [];
  const contagem = new Map<string, number>();
  for (const d of datasFeitas) contagem.set(inicioDaSemana(d), (contagem.get(inicioDaSemana(d)) ?? 0) + 1);
  const chaves = [...contagem.keys()].sort();
  const saida: Array<{ inicio: string; total: number }> = [];
  for (let s = chaves[0]; s <= chaves[chaves.length - 1]; s = somarSemana(s)) saida.push({ inicio: s, total: contagem.get(s) ?? 0 });
  return saida;
}

function somarSemana(inicio: string): string {
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** Perda real (kg, positiva = perdeu) pela tendência, relativa ao primeiro ponto do período. */
export function perdaRealPelaTendencia(tendencia: ReadonlyArray<{ data: string; tendencia: number }>, desde: string): Array<{ data: string; perdaKg: number }> {
  const no = tendencia.filter((t) => t.data >= desde);
  if (no.length === 0) return [];
  const base = no[0].tendencia;
  return no.map((t) => ({ data: t.data, perdaKg: Math.round((base - t.tendencia) * 100) / 100 }));
}

// ─── Plano × real ───

export type SituacaoPlano = "adiantado" | "no_ritmo" | "atrasado" | "sem_dados";

/**
 * Compara a tendência de hoje com o peso previsto pela projeção guardada (na semana correspondente).
 * Margem de 0,5 kg para "no ritmo". Sem projeção ou depois do fim dela: sem dados.
 */
export function compararPlanoReal(args: {
  projecaoCriadaEm: string;
  pontos: ReadonlyArray<{ semana: number; peso: number }>;
  hoje: string;
  tendenciaAtualKg: number | null;
  /** Meta de peso: define se "menor" é adiantado (perder) ou atrasado (ganhar). */
  pesoMetaKg: number;
}): { situacao: SituacaoPlano; previstoKg: number | null; diferencaKg: number | null; semana: number } {
  const semana = Math.floor(diasEntre(args.projecaoCriadaEm, args.hoje) / 7);
  if (args.tendenciaAtualKg === null || args.pontos.length === 0 || semana < 1) return { situacao: "sem_dados", previstoKg: null, diferencaKg: null, semana };
  const ponto = args.pontos.find((p) => p.semana === semana) ?? (semana > args.pontos[args.pontos.length - 1].semana ? args.pontos[args.pontos.length - 1] : null);
  if (!ponto) return { situacao: "sem_dados", previstoKg: null, diferencaKg: null, semana };
  const dif = Math.round((args.tendenciaAtualKg - ponto.peso) * 10) / 10; // positivo = mais pesado que o previsto
  const perder = args.pesoMetaKg < (args.pontos[0]?.peso ?? args.pesoMetaKg);
  const adiante = perder ? -dif : dif;
  const situacao: SituacaoPlano = Math.abs(dif) <= 0.5 ? "no_ritmo" : adiante > 0 ? "adiantado" : "atrasado";
  return { situacao, previstoKg: ponto.peso, diferencaKg: dif, semana };
}
