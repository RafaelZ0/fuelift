// Gasto calórico diário (funções puras, sem rede nem banco). Tudo aqui é ESTIMATIVA e é apresentado
// assim na interface: o corpo real varia, a pesagem oscila e o registro de comida nunca é perfeito.
import { diasEntre, tendenciaDoPeso } from "./treino";

export const NIVEIS_ATIVIDADE = ["sedentario", "leve", "moderado", "alto", "muito_alto"] as const;
export type NivelAtividade = (typeof NIVEIS_ATIVIDADE)[number];

/** Fatores usuais aplicados à taxa metabólica basal (Harris-Benedict/FAO). */
export const FATORES_ATIVIDADE: Record<NivelAtividade, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  alto: 1.725,
  muito_alto: 1.9,
};

export const ROTULOS_ATIVIDADE: Record<NivelAtividade, string> = {
  sedentario: "Sedentário: trabalho sentado e pouco ou nenhum exercício",
  leve: "Leve: exercício 1 a 3 vezes por semana",
  moderado: "Moderado: exercício 3 a 5 vezes por semana",
  alto: "Alto: exercício 6 a 7 vezes por semana, ou trabalho em pé e físico",
  muito_alto: "Muito alto: treino intenso todo dia ou trabalho muito pesado",
};

/** Aproximação da literatura: 1 kg de peso corporal ≈ 7.700 kcal. Constante configurável. */
export const KCAL_POR_KG = 7700;

export type Sexo = "masculino" | "feminino";

export type EntradaFormula = {
  sexo: Sexo;
  idadeAnos: number;
  alturaCm: number;
  pesoKg: number;
  /** Massa magra da última avaliação (kg), se houver. */
  massaMagraKg: number | null;
  nivel: NivelAtividade;
};

export type GastoFormula = { metodo: "katch_mcardle" | "mifflin_st_jeor"; tmb: number; fator: number; gasto: number };

export function tmbMifflin(e: Pick<EntradaFormula, "sexo" | "pesoKg" | "alturaCm" | "idadeAnos">): number {
  return 10 * e.pesoKg + 6.25 * e.alturaCm - 5 * e.idadeAnos + (e.sexo === "masculino" ? 5 : -161);
}

export function tmbKatch(massaMagraKg: number): number {
  return 370 + 21.6 * massaMagraKg;
}

/** Katch-McArdle só vale com massa magra plausível (entre 5 kg e o peso total). */
export function massaMagraValida(massaMagraKg: number | null, pesoKg: number): massaMagraKg is number {
  return massaMagraKg !== null && massaMagraKg >= 5 && massaMagraKg < pesoKg;
}

export function gastoPorFormula(e: EntradaFormula): GastoFormula {
  const usaKatch = massaMagraValida(e.massaMagraKg, e.pesoKg);
  const tmb = usaKatch ? tmbKatch(e.massaMagraKg as number) : tmbMifflin(e);
  const fator = FATORES_ATIVIDADE[e.nivel];
  return { metodo: usaKatch ? "katch_mcardle" : "mifflin_st_jeor", tmb: Math.round(tmb), fator, gasto: Math.round(tmb * fator) };
}

// ─── Gasto adaptativo ───

export const ADAPTATIVO = {
  janelaDias: 28,
  minDiasComRegistro: 14,
  minPesagens: 6,
  minSpanPesagensDias: 10,
  /** Abaixo disto o dia não conta como "registro completo" (quase certamente faltou comida). */
  kcalMinimaDoDia: 800,
} as const;

export type DiaConsumo = { data: string; kcal: number | null; proteinaG?: number | null };
export type PesagemDia = { data: string; peso: number };

export type GastoAdaptativo = {
  valor: number;
  minimo: number;
  maximo: number;
  diasUsados: number;
  consumoMedio: number;
  variacaoTendenciaKg: number;
};

export type ResultadoAdaptativo = { ok: true; gasto: GastoAdaptativo } | { ok: false; motivo: string };

const arred10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Gasto ≈ média de calorias consumidas − (variação da tendência do peso × 7.700 ÷ dias).
 * Usa a tendência (média móvel exponencial), não a pesagem do dia. Exige registro de comida em pelo
 * menos 14 dos últimos 28 dias e pesagens suficientes; senão devolve o motivo (a tela mostra a fórmula).
 * Resultados muito fora da fórmula são recusados: costumam indicar registro incompleto.
 */
export function gastoAdaptativo(args: { consumo: ReadonlyArray<DiaConsumo>; pesagens: ReadonlyArray<PesagemDia>; hoje: string; gastoFormula: number }): ResultadoAdaptativo {
  const { hoje } = args;
  const inicio = diasAntes(hoje, ADAPTATIVO.janelaDias - 1);
  const dias = args.consumo.filter((d) => d.data >= inicio && d.data <= hoje && d.kcal !== null && d.kcal >= ADAPTATIVO.kcalMinimaDoDia);
  if (dias.length < ADAPTATIVO.minDiasComRegistro) {
    return { ok: false, motivo: `Faltam registros de comida: ${dias.length} de ${ADAPTATIVO.minDiasComRegistro} dias nos últimos ${ADAPTATIVO.janelaDias}.` };
  }
  const todas = tendenciaDoPeso(args.pesagens.map((p) => ({ data: p.data, peso: p.peso })));
  const naJanela = todas.filter((p) => p.data >= inicio && p.data <= hoje);
  if (naJanela.length < ADAPTATIVO.minPesagens) {
    return { ok: false, motivo: `Faltam pesagens: ${naJanela.length} de ${ADAPTATIVO.minPesagens} nos últimos ${ADAPTATIVO.janelaDias} dias.` };
  }
  const primeira = naJanela[0];
  const ultima = naJanela[naJanela.length - 1];
  const span = diasEntre(primeira.data, ultima.data);
  if (span < ADAPTATIVO.minSpanPesagensDias) {
    return { ok: false, motivo: `As pesagens cobrem só ${span} dias; preciso de pelo menos ${ADAPTATIVO.minSpanPesagensDias}.` };
  }
  const consumoMedio = dias.reduce((s, d) => s + (d.kcal as number), 0) / dias.length;
  const variacao = ultima.tendencia - primeira.tendencia;
  const valor = consumoMedio - (variacao * KCAL_POR_KG) / span;
  if (valor < args.gastoFormula * 0.6 || valor > args.gastoFormula * 1.6) {
    return { ok: false, motivo: "Os dados de comida e peso estão muito diferentes do esperado (registro incompleto?). Mostrando a estimativa por fórmula." };
  }
  // Incerteza: ±0,5 kg na tendência e ±10% no registro de comida (somadas em quadratura).
  const erroPeso = (0.5 * KCAL_POR_KG) / span;
  const erroComida = consumoMedio * 0.1;
  const incerteza = Math.max(150, Math.sqrt(erroPeso ** 2 + erroComida ** 2));
  return {
    ok: true,
    gasto: {
      valor: arred10(valor),
      minimo: arred10(valor - incerteza),
      maximo: arred10(valor + incerteza),
      diasUsados: dias.length,
      consumoMedio: Math.round(consumoMedio),
      variacaoTendenciaKg: Math.round(variacao * 100) / 100,
    },
  };
}

function diasAntes(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── O que mostrar na tela ───

export type GastoParaTela = {
  valor: number;
  minimo: number;
  maximo: number;
  metodo: "adaptativo" | GastoFormula["metodo"];
  explicacao: string;
};

/** Escolhe o gasto a exibir: adaptativo quando há dados suficientes, senão a fórmula (±10%, com o motivo). */
export function gastoParaExibir(formula: GastoFormula, adaptativo: ResultadoAdaptativo | null): GastoParaTela {
  if (adaptativo?.ok) {
    const g = adaptativo.gasto;
    return {
      valor: g.valor,
      minimo: g.minimo,
      maximo: g.maximo,
      metodo: "adaptativo",
      explicacao: `Calculado com o que você comeu (média de ${fmt(g.consumoMedio)} kcal em ${g.diasUsados} dias) e a variação da sua tendência de peso (${g.variacaoTendenciaKg > 0 ? "+" : ""}${String(g.variacaoTendenciaKg).replace(".", ",")} kg). Estimativa.`,
    };
  }
  const nome = formula.metodo === "katch_mcardle" ? "Katch-McArdle (usa sua massa magra)" : "Mifflin-St Jeor";
  return {
    valor: formula.gasto,
    minimo: arred10(formula.gasto * 0.9),
    maximo: arred10(formula.gasto * 1.1),
    metodo: formula.metodo,
    explicacao: `Calculado por fórmula (${nome}) com seu nível de atividade. ${adaptativo ? adaptativo.motivo : ""} Estimativa: com o tempo o app ajusta com os seus dados reais.`.trim(),
  };
}

const fmt = (n: number) => n.toLocaleString("pt-BR");
