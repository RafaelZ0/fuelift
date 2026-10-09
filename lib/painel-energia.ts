// Junta perfil, pesagens, consumo e meta no que as telas mostram (função pura, sem banco).
// Tudo é estimativa. Sem os dados do perfil, diz o que falta em vez de inventar um número.
import {
  ADAPTATIVO,
  gastoAdaptativo,
  gastoParaExibir,
  gastoPorFormula,
  massaMagraValida,
  type DiaConsumo,
  type GastoParaTela,
  type NivelAtividade,
  type PesagemDia,
  type Sexo,
} from "./energia";
import { dividirMacros, planejarMeta, projetarPeso, ritmoSemanalKg, type Macros, type Planejamento, type Projecao } from "./projecao";
import { tendenciaDoPeso } from "./treino";

export type EntradaPainel = {
  hoje: string;
  perfil: { sexo: Sexo | null; idadeAnos: number | null; alturaCm: number | null; nivel: NivelAtividade | null; ritmoMaxPct: number };
  pesagens: ReadonlyArray<PesagemDia & { massaMagraKg: number | null }>;
  consumo: ReadonlyArray<DiaConsumo>;
  meta: { kcal: number | null; pesoMetaKg: number | null; dataMeta: string | null } | null;
};

export type PainelEnergia = {
  /** Campos que faltam no perfil/pesagens para calcular (vazio = tudo certo). */
  faltam: Array<"sexo" | "nascimento" | "altura" | "atividade" | "peso">;
  pesoAtualKg: number | null;
  tendenciaKg: number | null;
  tmb: number | null;
  fatorAtividade: number | null;
  gasto: GastoParaTela | null;
  /** Média de calorias dos últimos 7 dias com registro (precisa de pelo menos 3 dias). */
  consumoMedio7d: { kcal: number; dias: number } | null;
  /** Se continuar comendo a média dos últimos 7 dias: kg por semana (positivo = perde). */
  ritmoAtualKgSemana: number | null;
  /** O que a meta de calorias do dia significa para o peso. */
  previsaoDaMeta: { kcal: number; kgSemana: number; texto: string } | null;
  planejamento: Planejamento | null;
  /** Projeção com o consumo médio real (não com o plano). */
  projecaoReal: Projecao | null;
  macrosSugeridos: Macros | null;
};

const arred = (n: number, c = 1) => Math.round(n * 10 ** c) / 10 ** c;
const pt = (n: number, c = 1) => String(arred(n, c)).replace(".", ",");

export function montarPainelEnergia(e: EntradaPainel): PainelEnergia {
  const faltam: PainelEnergia["faltam"] = [];
  if (!e.perfil.sexo) faltam.push("sexo");
  if (e.perfil.idadeAnos === null) faltam.push("nascimento");
  if (!e.perfil.alturaCm) faltam.push("altura");
  if (!e.perfil.nivel) faltam.push("atividade");

  const tendencia = tendenciaDoPeso(e.pesagens.map((p) => ({ data: p.data, peso: p.peso })));
  const ultimaPesagem = [...e.pesagens].sort((a, b) => b.data.localeCompare(a.data))[0] ?? null;
  const tendenciaKg = tendencia.at(-1)?.tendencia ?? null;
  const pesoAtualKg = tendenciaKg ?? ultimaPesagem?.peso ?? null;
  if (pesoAtualKg === null) faltam.push("peso");

  const vazio: PainelEnergia = {
    faltam,
    pesoAtualKg,
    tendenciaKg,
    tmb: null,
    fatorAtividade: null,
    gasto: null,
    consumoMedio7d: null,
    ritmoAtualKgSemana: null,
    previsaoDaMeta: null,
    planejamento: null,
    projecaoReal: null,
    macrosSugeridos: null,
  };
  if (faltam.length > 0 || pesoAtualKg === null) return vazio;

  const massaMagraKg = [...e.pesagens].sort((a, b) => b.data.localeCompare(a.data)).find((p) => p.massaMagraKg !== null)?.massaMagraKg ?? null;
  const formula = gastoPorFormula({
    sexo: e.perfil.sexo as Sexo,
    idadeAnos: e.perfil.idadeAnos as number,
    alturaCm: e.perfil.alturaCm as number,
    pesoKg: pesoAtualKg,
    massaMagraKg: massaMagraValida(massaMagraKg, pesoAtualKg) ? massaMagraKg : null,
    nivel: e.perfil.nivel as NivelAtividade,
  });
  const adaptativo = gastoAdaptativo({ consumo: e.consumo, pesagens: e.pesagens, hoje: e.hoje, gastoFormula: formula.gasto });
  const gasto = gastoParaExibir(formula, adaptativo);

  // Média dos últimos 7 dias com registro completo.
  const inicio7 = diasAntes(e.hoje, 6);
  const dias7 = e.consumo.filter((d) => d.data >= inicio7 && d.data <= e.hoje && d.kcal !== null && d.kcal >= ADAPTATIVO.kcalMinimaDoDia);
  const consumoMedio7d = dias7.length >= 3 ? { kcal: Math.round(dias7.reduce((s, d) => s + (d.kcal as number), 0) / dias7.length), dias: dias7.length } : null;
  const ritmoAtualKgSemana = consumoMedio7d ? arred(ritmoSemanalKg(gasto.valor, consumoMedio7d.kcal), 2) : null;

  const metaKcal = e.meta?.kcal ?? null;
  let previsaoDaMeta: PainelEnergia["previsaoDaMeta"] = null;
  if (metaKcal !== null) {
    const kg = arred(ritmoSemanalKg(gasto.valor, metaKcal), 2);
    const texto =
      Math.abs(kg) < 0.1
        ? `Com ${metaKcal.toLocaleString("pt-BR")} kcal por dia, a estimativa é manter o peso.`
        : kg > 0
          ? `Com ${metaKcal.toLocaleString("pt-BR")} kcal por dia, a estimativa é perder cerca de ${pt(kg, 2)} kg por semana.`
          : `Com ${metaKcal.toLocaleString("pt-BR")} kcal por dia, a estimativa é ganhar cerca de ${pt(-kg, 2)} kg por semana.`;
    previsaoDaMeta = { kcal: metaKcal, kgSemana: kg, texto };
  }

  const pesoMeta = e.meta?.pesoMetaKg ?? null;
  let planejamento: Planejamento | null = null;
  let projecaoReal: Projecao | null = null;
  let macrosSugeridos: Macros | null = null;
  if (pesoMeta !== null) {
    planejamento = planejarMeta({
      pesoAtual: pesoAtualKg,
      pesoMeta,
      alturaCm: e.perfil.alturaCm,
      dataAlvo: e.meta?.dataMeta ?? null,
      hoje: e.hoje,
      gasto: gasto.valor,
      tmb: formula.tmb,
      fatorAtividade: formula.fator,
      ritmoMaxPct: e.perfil.ritmoMaxPct,
    });
    if (consumoMedio7d) {
      projecaoReal = projetarPeso({ pesoInicial: pesoAtualKg, gastoInicial: gasto.valor, consumoDiario: consumoMedio7d.kcal, fatorAtividade: formula.fator, pesoMeta });
    }
    const escolhida = planejamento.opcoes.find((o) => o.recomendada) ?? planejamento.opcoes[0];
    if (escolhida) macrosSugeridos = dividirMacros({ kcal: escolhida.kcal, pesoKg: pesoAtualKg, emDeficit: planejamento.tipo === "perder" });
  }

  return { faltam, pesoAtualKg, tendenciaKg, tmb: formula.tmb, fatorAtividade: formula.fator, gasto, consumoMedio7d, ritmoAtualKgSemana, previsaoDaMeta, planejamento, projecaoReal, macrosSugeridos };
}

function diasAntes(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Períodos dos gráficos ───

export const PERIODOS = { "4s": 28, "3m": 90, tudo: 730 } as const;
export type Periodo = keyof typeof PERIODOS;
export const ROTULOS_PERIODO: Record<Periodo, string> = { "4s": "4 semanas", "3m": "3 meses", tudo: "Tudo" };

export function periodoValido(v: unknown): Periodo {
  return v === "4s" || v === "3m" || v === "tudo" ? v : "3m";
}

/** Déficit acumulado (kcal) × perda esperada (kg) por dia, a partir do consumo e do gasto estimado. */
export function deficitAcumulado(consumo: ReadonlyArray<DiaConsumo>, gastoDiario: number): Array<{ data: string; deficit: number; perdaEsperadaKg: number }> {
  let acum = 0;
  return [...consumo]
    .sort((a, b) => a.data.localeCompare(b.data))
    .filter((d) => d.kcal !== null && d.kcal >= ADAPTATIVO.kcalMinimaDoDia)
    .map((d) => {
      acum += gastoDiario - (d.kcal as number);
      return { data: d.data, deficit: Math.round(acum), perdaEsperadaKg: arred(acum / 7700, 2) };
    });
}
