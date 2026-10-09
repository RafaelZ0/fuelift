// Projeção de peso, ritmo seguro e sugestão de metas (funções puras). Os NÚMEROS vêm daqui; a IA, quando
// usada, só explica. Tudo é estimativa e as travas de segurança do CLAUDE.md valem sempre:
// ritmo acima de ~1% do peso por semana ou consumo abaixo da taxa metabólica basal não é sugerido.
import { KCAL_POR_KG } from "./energia";

/** Teto padrão (referência médica comum): até ~1% do peso corporal por semana. Configurável para MENOS. */
export const RITMO_MAX_PADRAO_PCT = 1;
/** Faixa que costuma ser recomendada para manter a massa magra e a adesão. */
export const RITMO_RECOMENDADO_PCT = { min: 0.5, max: 0.75 } as const;
export const IMC_MINIMO_SAUDAVEL = 18.5;
export const SEMANAS_MAX = 104;

export const imc = (pesoKg: number, alturaCm: number) => pesoKg / (alturaCm / 100) ** 2;
const arred = (n: number, c = 1) => Math.round(n * 10 ** c) / 10 ** c;

/** Perda por semana em kg (positivo = perde peso) para um consumo diário médio. */
export function ritmoSemanalKg(gastoKcal: number, consumoKcal: number): number {
  return ((gastoKcal - consumoKcal) * 7) / KCAL_POR_KG;
}

/** O gasto muda com o peso: cada kg a menos reduz a taxa basal em ~10 kcal (Mifflin), vezes o fator de atividade. */
export function gastoNoPeso(gastoAtual: number, pesoAtual: number, peso: number, fatorAtividade: number): number {
  return gastoAtual + (peso - pesoAtual) * 10 * fatorAtividade;
}

export type PontoProjecao = { semana: number; peso: number; gasto: number };
export type Projecao = {
  pontos: PontoProjecao[];
  /** Semanas até a meta (null se não chega). */
  semanasParaMeta: number | null;
  /** Peso em que tende a estabilizar com esse consumo (quando não chega à meta). */
  pesoDeEquilibrio: number | null;
};

/** Simulação semana a semana, recalculando o gasto para o peso projetado (uma linha reta seria otimista demais). */
export function projetarPeso(args: { pesoInicial: number; gastoInicial: number; consumoDiario: number; fatorAtividade: number; pesoMeta: number | null }): Projecao {
  const { pesoInicial, gastoInicial, consumoDiario, fatorAtividade, pesoMeta } = args;
  const pontos: PontoProjecao[] = [{ semana: 0, peso: arred(pesoInicial, 2), gasto: Math.round(gastoInicial) }];
  let peso = pesoInicial;
  const emagrecendo = pesoMeta !== null && pesoMeta < pesoInicial;
  const engordando = pesoMeta !== null && pesoMeta > pesoInicial;
  let semanasParaMeta: number | null = null;
  let pesoDeEquilibrio: number | null = null; // definido depois do laço
  for (let s = 1; s <= SEMANAS_MAX; s++) {
    const gasto = gastoNoPeso(gastoInicial, pesoInicial, peso, fatorAtividade);
    const variacao = ((consumoDiario - gasto) * 7) / KCAL_POR_KG; // kg por semana (positivo = ganha)
    const novo = peso + variacao;
    if (Math.abs(variacao) < 0.02) break;
    peso = novo;
    pontos.push({ semana: s, peso: arred(peso, 2), gasto: Math.round(gastoNoPeso(gastoInicial, pesoInicial, peso, fatorAtividade)) });
    if ((emagrecendo && peso <= (pesoMeta as number)) || (engordando && peso >= (pesoMeta as number))) {
      semanasParaMeta = s;
      break;
    }
  }
  // Peso em que o gasto iguala o consumo (a simulação converge para ele): mostra onde estabiliza.
  if (semanasParaMeta === null) pesoDeEquilibrio = arred(pesoInicial - (gastoInicial - consumoDiario) / (10 * fatorAtividade), 1);
  return { pontos, semanasParaMeta, pesoDeEquilibrio };
}

/** Marcos intermediários (a cada `passo` kg) entre o peso atual e a meta, sem incluir o atual. */
export function marcos(pesoAtual: number, pesoMeta: number, passo = 5): number[] {
  const lista: number[] = [];
  const sentido = pesoMeta < pesoAtual ? -1 : 1;
  for (let p = pesoAtual + sentido * passo; sentido === -1 ? p > pesoMeta : p < pesoMeta; p += sentido * passo) lista.push(arred(p, 1));
  lista.push(pesoMeta);
  return lista;
}

// ─── Metas sugeridas ───

export type OpcaoRitmo = {
  id: "leve" | "moderado" | "firme";
  rotulo: string;
  pctSemana: number;
  kgSemana: number;
  deficitDia: number;
  kcal: number;
  /** Foi limitada para não ficar abaixo da taxa metabólica basal. */
  limitadaPorTmb: boolean;
  semanasParaMeta: number | null;
  pesoDeEquilibrio: number | null;
  recomendada: boolean;
};

export type AvisoMeta = { nivel: "atencao" | "bloqueio"; texto: string };

export type Planejamento = {
  tipo: "perder" | "manter" | "ganhar";
  opcoes: OpcaoRitmo[];
  /** Com data desejada: o que ela exigiria. */
  paraData: { semanas: number; kgSemana: number; pctSemana: number; kcal: number; viavel: boolean } | null;
  avisos: AvisoMeta[];
};

export type EntradaPlano = {
  pesoAtual: number;
  pesoMeta: number;
  alturaCm: number | null;
  /** Data desejada (AAAA-MM-DD) e hoje, para calcular o ritmo exigido. */
  dataAlvo: string | null;
  hoje: string;
  gasto: number;
  tmb: number;
  fatorAtividade: number;
  ritmoMaxPct: number;
};

function diasEntreDatas(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const DEFS: Array<{ id: OpcaoRitmo["id"]; rotulo: string; pct: number }> = [
  { id: "leve", rotulo: "Leve", pct: 0.25 },
  { id: "moderado", rotulo: "Moderado", pct: 0.5 },
  { id: "firme", rotulo: "Firme", pct: 0.75 },
];

/** Opções de calorias para a meta, respeitando as travas de segurança. Nunca sugere abaixo da TMB nem acima do ritmo máximo. */
export function planejarMeta(e: EntradaPlano): Planejamento {
  const avisos: AvisoMeta[] = [];
  const max = Math.min(e.ritmoMaxPct, RITMO_MAX_PADRAO_PCT);
  const tipo: Planejamento["tipo"] = e.pesoMeta < e.pesoAtual - 0.05 ? "perder" : e.pesoMeta > e.pesoAtual + 0.05 ? "ganhar" : "manter";

  if (e.alturaCm) {
    if (imc(e.pesoMeta, e.alturaCm) < IMC_MINIMO_SAUDAVEL) {
      avisos.push({ nivel: "bloqueio", texto: `Essa meta deixa o IMC abaixo de ${String(IMC_MINIMO_SAUDAVEL).replace(".", ",")} (peso abaixo do considerado saudável). Converse com o nutricionista ou o médico antes de definir.` });
    }
    if (tipo === "perder" && imc(e.pesoAtual, e.alturaCm) < IMC_MINIMO_SAUDAVEL) {
      avisos.push({ nivel: "bloqueio", texto: "Seu IMC atual já está abaixo do considerado saudável. O app não sugere calorias para perder peso. Converse com um profissional de saúde." });
    }
  }
  const bloqueado = avisos.some((a) => a.nivel === "bloqueio");

  if (tipo === "manter") {
    return { tipo, opcoes: [opcao("manter", "Manter", 0, e, null)], paraData: null, avisos };
  }
  if (tipo === "ganhar") {
    const ops = [0.15, 0.25].map((pct, i) => {
      const kgSem = (pct / 100) * e.pesoAtual;
      const kcal = Math.round(e.gasto + (kgSem * KCAL_POR_KG) / 7);
      return opcaoGanho(i === 0 ? "leve" : "moderado", i === 0 ? "Leve" : "Moderado", pct, kgSem, kcal, e);
    });
    return { tipo, opcoes: bloqueado ? [] : ops, paraData: null, avisos };
  }

  const opcoes: OpcaoRitmo[] = bloqueado
    ? []
    : DEFS.filter((d) => d.pct <= max + 1e-9).map((d) => {
        const kgSem = (d.pct / 100) * e.pesoAtual;
        return opcao(d.id, d.rotulo, d.pct, e, kgSem);
      });
  // A "moderada" costuma ser a mais sustentável; se o teto do usuário for menor, a maior que couber.
  const alvo = opcoes.find((o) => o.id === "moderado") ?? opcoes.at(-1);
  if (alvo) alvo.recomendada = true;

  let paraData: Planejamento["paraData"] = null;
  if (e.dataAlvo) {
    const dias = diasEntreDatas(e.hoje, e.dataAlvo);
    if (dias < 7) {
      avisos.push({ nivel: "atencao", texto: "A data desejada precisa ficar pelo menos uma semana à frente." });
    } else {
      const semanas = dias / 7;
      const kgSemana = (e.pesoAtual - e.pesoMeta) / semanas;
      const pct = (kgSemana / e.pesoAtual) * 100;
      const kcal = Math.round(e.gasto - (kgSemana * KCAL_POR_KG) / 7);
      const viavel = pct <= max && kcal >= e.tmb;
      paraData = { semanas: arred(semanas, 1), kgSemana: arred(kgSemana, 2), pctSemana: arred(pct, 2), kcal, viavel };
      if (pct > max) {
        avisos.push({
          nivel: "atencao",
          texto: `Para chegar nessa data seria preciso perder ${String(arred(kgSemana, 2)).replace(".", ",")} kg por semana (${String(arred(pct, 1)).replace(".", ",")}% do peso), acima do máximo de ${String(max).replace(".", ",")}% por semana. Converse com o nutricionista; o app não sugere esse ritmo.`,
        });
      } else if (kcal < e.tmb) {
        avisos.push({ nivel: "atencao", texto: "Para chegar nessa data o consumo ficaria abaixo da sua taxa metabólica basal estimada. O app não sugere isso; converse com o nutricionista." });
      } else if (pct > RITMO_RECOMENDADO_PCT.max) {
        avisos.push({ nivel: "atencao", texto: "Esse ritmo é viável, mas está acima da faixa que costuma ser recomendada (0,5 a 0,75% por semana). Vale combinar com o nutricionista." });
      }
    }
  }
  return { tipo, opcoes, paraData, avisos };
}

function opcao(id: OpcaoRitmo["id"] | "manter", rotulo: string, pct: number, e: EntradaPlano, kgSemana: number | null): OpcaoRitmo {
  const kgSem = kgSemana ?? 0;
  let kcal = Math.round(e.gasto - (kgSem * KCAL_POR_KG) / 7);
  let limitadaPorTmb = false;
  if (kcal < e.tmb) {
    kcal = Math.round(e.tmb);
    limitadaPorTmb = true;
  }
  const real = ritmoSemanalKg(e.gasto, kcal);
  const proj = projetarPeso({ pesoInicial: e.pesoAtual, gastoInicial: e.gasto, consumoDiario: kcal, fatorAtividade: e.fatorAtividade, pesoMeta: e.pesoMeta });
  return {
    id: id === "manter" ? "moderado" : id,
    rotulo,
    pctSemana: arred((real / e.pesoAtual) * 100, 2),
    kgSemana: arred(real, 2),
    deficitDia: Math.max(0, e.gasto - kcal),
    kcal,
    limitadaPorTmb,
    semanasParaMeta: proj.semanasParaMeta,
    pesoDeEquilibrio: proj.pesoDeEquilibrio,
    recomendada: false,
  };
}

function opcaoGanho(id: OpcaoRitmo["id"], rotulo: string, pct: number, kgSem: number, kcal: number, e: EntradaPlano): OpcaoRitmo {
  const proj = projetarPeso({ pesoInicial: e.pesoAtual, gastoInicial: e.gasto, consumoDiario: kcal, fatorAtividade: e.fatorAtividade, pesoMeta: e.pesoMeta });
  return { id, rotulo, pctSemana: arred(pct, 2), kgSemana: arred(-kgSem, 2), deficitDia: 0, kcal, limitadaPorTmb: false, semanasParaMeta: proj.semanasParaMeta, pesoDeEquilibrio: proj.pesoDeEquilibrio, recomendada: id === "leve" };
}

// ─── Divisão de macros ───

export type Macros = { proteinaG: number; carboG: number; gorduraG: number; kcal: number };

/**
 * Proteína 1,8 g/kg (2,0 em déficit, para proteger a massa magra; teto 2,2 g/kg e 35% das calorias);
 * gordura: o maior entre 0,7 g/kg e 25% das calorias; carboidrato: o restante (mínimo de 50 g).
 */
export function dividirMacros(args: { kcal: number; pesoKg: number; emDeficit: boolean }): Macros {
  const { kcal, pesoKg, emDeficit } = args;
  let proteina = Math.min((emDeficit ? 2 : 1.8) * pesoKg, 2.2 * pesoKg, (0.35 * kcal) / 4);
  proteina = Math.max(proteina, 0);
  const gordura = Math.max(0.7 * pesoKg, (0.25 * kcal) / 9);
  let carbo = (kcal - proteina * 4 - gordura * 9) / 4;
  if (carbo < 50) carbo = 50;
  return { proteinaG: Math.round(proteina), carboG: Math.round(carbo), gorduraG: Math.round(gordura), kcal: Math.round(proteina) * 4 + Math.round(carbo) * 4 + Math.round(gordura) * 9 };
}

/** Aviso para uma meta digitada pelo usuário (ex.: combinada com o nutricionista): a trava vale também aqui. */
export function avisoDeMetaDigitada(args: { kcal: number; tmb: number | null; gasto: number | null; pesoAtual: number | null; ritmoMaxPct: number }): string | null {
  const { kcal, tmb, gasto, pesoAtual } = args;
  if (tmb !== null && kcal < tmb) {
    return `Essa meta fica abaixo da sua taxa metabólica basal estimada (${Math.round(tmb)} kcal). Converse com o nutricionista antes de seguir.`;
  }
  if (gasto !== null && pesoAtual !== null) {
    const pct = (ritmoSemanalKg(gasto, kcal) / pesoAtual) * 100;
    const max = Math.min(args.ritmoMaxPct, RITMO_MAX_PADRAO_PCT);
    if (pct > max) {
      return `Com essa meta a perda prevista é de cerca de ${String(arred(pct, 1)).replace(".", ",")}% do peso por semana, acima de ${String(max).replace(".", ",")}%. Converse com o nutricionista.`;
    }
  }
  return null;
}
