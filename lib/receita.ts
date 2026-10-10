// Cálculo de receitas (funções puras). A receita soma os ingredientes, divide pelo peso final e pelo
// rendimento em porções, e vira um alimento do usuário (valores por 100 g, mesmos limites do banco).
export const LIMITES_RECEITA = { itens: 40, porcoesMin: 0.5, porcoesMax: 200, pesoFinalMax: 50000 } as const;

export type NutrientesIngrediente = {
  kcal: number | null;
  proteinaG: number | null;
  carboG: number | null;
  gorduraG: number | null;
  fibraG: number | null;
};

export type IngredienteReceita = { nome: string; gramas: number; nutrientes: NutrientesIngrediente };

export type Totais = { kcal: number; proteinaG: number; carboG: number; gorduraG: number; fibraG: number };
export type CamposParciais = { proteinaG: boolean; carboG: boolean; gorduraG: boolean; fibraG: boolean };

export type ResultadoReceita =
  | {
      ok: true;
      totais: Totais;
      pesoFinalG: number;
      porcoes: number;
      /** Valores por 100 g do prato pronto (viram o alimento do usuário). */
      por100g: Totais;
      porPorcao: Totais & { gramas: number };
      /** Algum ingrediente não tem esse nutriente na tabela: o total é parcial. */
      parcial: CamposParciais;
    }
  | { ok: false; erro: string };

const arred = (n: number, c = 2) => Math.round(n * 10 ** c) / 10 ** c;

export function calcularReceita(args: { ingredientes: ReadonlyArray<IngredienteReceita>; porcoes: number; pesoFinalG: number | null }): ResultadoReceita {
  const { ingredientes, porcoes } = args;
  if (ingredientes.length === 0) return { ok: false, erro: "Adicione pelo menos um ingrediente." };
  if (ingredientes.length > LIMITES_RECEITA.itens) return { ok: false, erro: `Use no máximo ${LIMITES_RECEITA.itens} ingredientes.` };
  if (!(porcoes >= LIMITES_RECEITA.porcoesMin && porcoes <= LIMITES_RECEITA.porcoesMax)) return { ok: false, erro: "Informe quantas porções a receita rende (de 0,5 a 200)." };

  const somaGramas = ingredientes.reduce((s, i) => s + i.gramas, 0);
  const pesoFinalG = args.pesoFinalG ?? somaGramas;
  if (!(pesoFinalG >= 1 && pesoFinalG <= LIMITES_RECEITA.pesoFinalMax)) return { ok: false, erro: "Peso final da receita inválido." };

  const semKcal = ingredientes.find((i) => i.nutrientes.kcal === null);
  if (semKcal) return { ok: false, erro: `"${semKcal.nome}" está sem calorias na tabela. Troque o ingrediente.` };

  const totais: Totais = { kcal: 0, proteinaG: 0, carboG: 0, gorduraG: 0, fibraG: 0 };
  const parcial: CamposParciais = { proteinaG: false, carboG: false, gorduraG: false, fibraG: false };
  for (const i of ingredientes) {
    totais.kcal += i.nutrientes.kcal as number;
    for (const c of ["proteinaG", "carboG", "gorduraG", "fibraG"] as const) {
      const v = i.nutrientes[c];
      if (v === null) parcial[c] = true;
      else totais[c] += v;
    }
  }
  const por100g: Totais = {
    kcal: arred((totais.kcal / pesoFinalG) * 100),
    proteinaG: arred((totais.proteinaG / pesoFinalG) * 100),
    carboG: arred((totais.carboG / pesoFinalG) * 100),
    gorduraG: arred((totais.gorduraG / pesoFinalG) * 100),
    fibraG: arred((totais.fibraG / pesoFinalG) * 100),
  };
  if (por100g.kcal > 900) return { ok: false, erro: "Passa de 900 kcal por 100 g. Confira as quantidades e o peso final." };
  for (const c of ["proteinaG", "carboG", "gorduraG", "fibraG"] as const) {
    if (por100g[c] > 100) return { ok: false, erro: "Algum nutriente passa de 100 g por 100 g. Confira o peso final: ele não pode ser menor que o possível." };
  }
  if (por100g.proteinaG + por100g.carboG + por100g.gorduraG > 100.5) {
    return { ok: false, erro: "Proteína, carboidrato e gordura passam de 100 g por 100 g. Confira o peso final da receita." };
  }
  const gramasPorcao = arred(pesoFinalG / porcoes, 1);
  const f = pesoFinalG / porcoes / 100;
  return {
    ok: true,
    totais: { kcal: arred(totais.kcal), proteinaG: arred(totais.proteinaG), carboG: arred(totais.carboG), gorduraG: arred(totais.gorduraG), fibraG: arred(totais.fibraG) },
    pesoFinalG: arred(pesoFinalG, 1),
    porcoes,
    por100g,
    porPorcao: {
      gramas: gramasPorcao,
      kcal: arred(por100g.kcal * f),
      proteinaG: arred(por100g.proteinaG * f),
      carboG: arred(por100g.carboG * f),
      gorduraG: arred(por100g.gorduraG * f),
      fibraG: arred(por100g.fibraG * f),
    },
    parcial,
  };
}
