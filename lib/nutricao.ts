// Cálculos de nutrientes (funções puras, sem banco). Valores dos alimentos são por 100 g.
// null = desconhecido: nunca vira zero sem aviso.

export type Por100g = {
  kcal: number | null;
  proteinaG: number | null;
  carboG: number | null;
  gorduraG: number | null;
  fibraG: number | null;
};

export type Nutrientes = {
  kcal: number;
  proteinaG: number | null;
  carboG: number | null;
  gorduraG: number | null;
  fibraG: number | null;
};

export const CAMPOS_TOTAIS = ["kcal", "proteinaG", "carboG", "gorduraG", "fibraG"] as const;
export type CampoTotal = (typeof CAMPOS_TOTAIS)[number];

export const GRAMAS_MAX = 5000;
export const KCAL_MAX_ITEM = 10000;

/** Arredonda para `casas` decimais sem os erros clássicos de ponto flutuante. */
export function arredondar(valor: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * f) / f;
}

/** Gramas a partir de uma medida caseira (ex.: 1,5 × concha de 140 g = 210 g). */
export function gramasDaMedida(gramasPorMedida: number, quantidade: number): number {
  return arredondar(gramasPorMedida * quantidade, 2);
}

/** Converte valores da porção do rótulo para 100 g (ex.: 120 kcal em 30 g → 400 kcal/100 g). */
export function paraPor100g(valorNaPorcao: number | null, gramasDaPorcao: number): number | null {
  if (valorNaPorcao === null) return null;
  return arredondar((valorNaPorcao * 100) / gramasDaPorcao, 2);
}

/**
 * Nutrientes de `gramas` de um alimento. Exige calorias conhecidas: um alimento
 * sem kcal não pode ser registrado (retorna null).
 */
export function calcularNutrientes(alimento: Por100g, gramas: number): Nutrientes | null {
  if (alimento.kcal === null || !(gramas > 0)) return null;
  const fator = gramas / 100;
  const calc = (v: number | null) => (v === null ? null : arredondar(v * fator, 2));
  return {
    kcal: arredondar(alimento.kcal * fator, 2),
    proteinaG: calc(alimento.proteinaG),
    carboG: calc(alimento.carboG),
    gorduraG: calc(alimento.gorduraG),
    fibraG: calc(alimento.fibraG),
  };
}

export type Totais = Record<CampoTotal, number> & { parcial: Record<CampoTotal, boolean> };

/** Soma os registros do dia. Se algum item não tem um nutriente, o total dele fica marcado como parcial. */
export function somarDia(itens: ReadonlyArray<Nutrientes>): Totais {
  const totais = { kcal: 0, proteinaG: 0, carboG: 0, gorduraG: 0, fibraG: 0 } as Record<CampoTotal, number>;
  const parcial = { kcal: false, proteinaG: false, carboG: false, gorduraG: false, fibraG: false };
  for (const item of itens) {
    for (const campo of CAMPOS_TOTAIS) {
      const v = item[campo];
      if (v === null) parcial[campo] = true;
      else totais[campo] += v;
    }
  }
  for (const campo of CAMPOS_TOTAIS) totais[campo] = arredondar(totais[campo], 2);
  return { ...totais, parcial };
}

export type Comparacao = { consumido: number; meta: number | null; restante: number | null; percentual: number | null };

/** Consumido × meta. Sem meta definida, só mostra o consumido. */
export function compararComMeta(consumido: number, meta: number | null): Comparacao {
  if (meta === null || meta <= 0) return { consumido, meta: null, restante: null, percentual: null };
  return {
    consumido,
    meta,
    restante: arredondar(meta - consumido, 2),
    percentual: Math.round((consumido / meta) * 100),
  };
}

/** Formatação para a tela: kcal e sódio sem casas, gramas com 1 casa (como a TACO). */
export function formatarKcal(v: number | null): string {
  return v === null ? "—" : Math.round(v).toLocaleString("pt-BR");
}

export function formatarGramas(v: number | null): string {
  return v === null ? "—" : arredondar(v, 1).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
