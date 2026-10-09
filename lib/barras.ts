// Código de barras e dados de produto (funções puras, sem rede nem banco).
// Fonte dos produtos: Open Food Facts (licença ODbL). A resposta é DADO NÃO CONFIÁVEL: tudo passa por
// limpeza de texto e por limites de sanidade antes de virar um alimento.
import { limparTexto } from "@/lib/ia/rascunho";

/** Aceita só dígitos com 8 (EAN-8), 12 (UPC-A) ou 13 (EAN-13) posições e dígito verificador correto. */
export function normalizarCodigo(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const d = bruto.trim();
  if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(d)) return null;
  const corpo = d.slice(0, -1);
  // Pesos alternados 3 e 1, contando da direita para a esquerda (padrão GS1).
  let soma = 0;
  for (let i = 0; i < corpo.length; i++) soma += Number(corpo[corpo.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  const digito = (10 - (soma % 10)) % 10;
  if (digito !== Number(d.at(-1))) return null;
  return d.length === 12 ? `0${d}` : d; // UPC-A vira EAN-13 com zero à esquerda
}

export type Nutrientes100g = {
  kcal: number | null;
  proteinaG: number | null;
  carboG: number | null;
  gorduraG: number | null;
  fibraG: number | null;
  sodioMg: number | null;
};

export type ProdutoExtraido =
  | { status: "nao_encontrado" }
  | {
      status: "encontrado";
      nome: string;
      marca: string | null;
      quantidade: string | null;
      porcaoG: number | null;
      nutrientes: Nutrientes100g;
      /** Faltam calorias ou algum macro: o produto não é adicionado sozinho. */
      incompleto: boolean;
      /** Valores que não passaram nos limites (descartados): o rótulo pode estar errado no cadastro público. */
      suspeito: boolean;
    };

const numero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const faixa = (v: number | null, max: number): number | null => (v !== null && v >= 0 && v <= max ? v : null);
const arredonda = (v: number | null, casas = 2): number | null => (v === null ? null : Math.round(v * 10 ** casas) / 10 ** casas);

/** Calorias de 4/4/9 kcal por grama: usada só para conferir se os números "fecham". */
export function kcalEsperadas(proteinaG: number, carboG: number, gorduraG: number): number {
  return 4 * proteinaG + 4 * carboG + 9 * gorduraG;
}

export type ConferenciaEnergia = { fecha: boolean; esperadas: number | null; diferenca: number | null };

/**
 * A conta fecha quando as calorias ficam perto de 4×proteína + 4×carboidrato + 9×gordura.
 * Tolerância: 25% ou 30 kcal (o que for maior), porque rótulos arredondam, têm fibra, polióis e álcool.
 * Sem os três macros não há como conferir (fecha = true, esperadas = null).
 */
export function conferirEnergia(n: Nutrientes100g): ConferenciaEnergia {
  if (n.kcal === null || n.proteinaG === null || n.carboG === null || n.gorduraG === null) {
    return { fecha: true, esperadas: null, diferenca: null };
  }
  const esperadas = kcalEsperadas(n.proteinaG, n.carboG, n.gorduraG);
  const diferenca = n.kcal - esperadas;
  const tolerancia = Math.max(30, esperadas * 0.25);
  return { fecha: Math.abs(diferenca) <= tolerancia, esperadas: arredonda(esperadas, 0), diferenca: arredonda(diferenca, 0) };
}

/** Limites físicos por 100 g (os mesmos CHECKs do banco). Devolve mensagens em português, vazio se estiver ok. */
export function problemasDeSanidade(n: Nutrientes100g): string[] {
  const p: string[] = [];
  if (n.kcal !== null && (n.kcal < 0 || n.kcal > 900)) p.push("Calorias por 100 g devem ficar entre 0 e 900.");
  for (const [valor, rotulo] of [
    [n.proteinaG, "Proteína"],
    [n.carboG, "Carboidrato"],
    [n.gorduraG, "Gordura"],
    [n.fibraG, "Fibra"],
  ] as const) {
    if (valor !== null && (valor < 0 || valor > 100)) p.push(`${rotulo} por 100 g deve ficar entre 0 e 100.`);
  }
  const macros = (n.proteinaG ?? 0) + (n.carboG ?? 0) + (n.gorduraG ?? 0);
  if (macros > 100.5) p.push("Proteína, carboidrato e gordura juntos passam de 100 g em 100 g.");
  return p;
}

/**
 * Converte a resposta do Open Food Facts (API v2, campo `product`) em dados por 100 g.
 * Usa os campos `*_100g`; calorias podem vir só em kJ (÷ 4,184); sódio vem em gramas (× 1000 = mg).
 */
export function extrairProdutoOff(resposta: unknown): ProdutoExtraido {
  const r = (typeof resposta === "object" && resposta !== null ? resposta : {}) as Record<string, unknown>;
  const p = (typeof r.product === "object" && r.product !== null ? r.product : null) as Record<string, unknown> | null;
  if (r.status === 0 || !p) return { status: "nao_encontrado" };

  const nome = limparTexto(p.product_name_pt ?? p.product_name, 120);
  if (!nome) return { status: "nao_encontrado" };
  const nm = (typeof p.nutriments === "object" && p.nutriments !== null ? p.nutriments : {}) as Record<string, unknown>;

  const kcalDireto = numero(nm["energy-kcal_100g"]);
  const kj = numero(nm["energy-kj_100g"]) ?? numero(nm["energy_100g"]);
  const sodioG = numero(nm["sodium_100g"]);
  const bruto: Nutrientes100g = {
    kcal: kcalDireto ?? (kj !== null ? kj / 4.184 : null),
    proteinaG: numero(nm["proteins_100g"]),
    carboG: numero(nm["carbohydrates_100g"]),
    gorduraG: numero(nm["fat_100g"]),
    fibraG: numero(nm["fiber_100g"]),
    sodioMg: sodioG !== null ? sodioG * 1000 : null,
  };
  const nutrientes: Nutrientes100g = {
    kcal: arredonda(faixa(bruto.kcal, 900), 1),
    proteinaG: arredonda(faixa(bruto.proteinaG, 100)),
    carboG: arredonda(faixa(bruto.carboG, 100)),
    gorduraG: arredonda(faixa(bruto.gorduraG, 100)),
    fibraG: arredonda(faixa(bruto.fibraG, 100)),
    sodioMg: arredonda(faixa(bruto.sodioMg, 40000), 1),
  };
  const descartou = (Object.keys(bruto) as Array<keyof Nutrientes100g>).some((k) => bruto[k] !== null && nutrientes[k] === null);
  const macros = (nutrientes.proteinaG ?? 0) + (nutrientes.carboG ?? 0) + (nutrientes.gorduraG ?? 0);
  const somaAlta = macros > 100.5;
  const incompleto = nutrientes.kcal === null || nutrientes.proteinaG === null || nutrientes.carboG === null || nutrientes.gorduraG === null;
  const fecha = conferirEnergia(nutrientes).fecha;

  const porcao = numero(p.serving_quantity);
  return {
    status: "encontrado",
    nome,
    marca: limparTexto(typeof p.brands === "string" ? p.brands.split(",")[0] : "", 80) || null,
    quantidade: limparTexto(p.quantity, 40) || null,
    porcaoG: porcao !== null && porcao > 0 && porcao <= 2000 ? arredonda(porcao, 1) : null,
    nutrientes,
    incompleto,
    suspeito: descartou || somaAlta || !fecha,
  };
}

export type Destino = "adicionar" | "conferir" | "cadastrar";

/** Diz o que fazer com o produto lido: adicionar, pedir conferência ou cadastrar pelo rótulo. */
export function destinoDe(p: { status: "encontrado" | "nao_encontrado"; kcal: number | null; incompleto: boolean; suspeito: boolean }): Destino {
  if (p.status === "nao_encontrado" || p.kcal === null) return "cadastrar";
  return p.incompleto || p.suspeito ? "conferir" : "adicionar";
}

export function destinoDoProduto(p: ProdutoExtraido): Destino {
  if (p.status === "nao_encontrado") return "cadastrar";
  return destinoDe({ status: "encontrado", kcal: p.nutrientes.kcal, incompleto: p.incompleto, suspeito: p.suspeito });
}

/** Quanto tempo o cache vale: produto achado, 30 dias; "não encontrado", 1 dia (alguém pode cadastrar no Open Food Facts). */
export const VALIDADE_CACHE_DIAS = { encontrado: 30, nao_encontrado: 1 } as const;

export function cacheValido(status: "encontrado" | "nao_encontrado", consultadoEm: Date, agora: Date = new Date()): boolean {
  const dias = (agora.getTime() - consultadoEm.getTime()) / 86_400_000;
  // Tolera até 1 hora de diferença entre o relógio do servidor e o do banco.
  return dias >= -1 / 24 && dias < VALIDADE_CACHE_DIAS[status];
}
