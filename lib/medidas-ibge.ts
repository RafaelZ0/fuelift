// Escolha das sugestões de medidas do IBGE para um alimento (função pura, testada).
// O nome do IBGE precisa conter o alimento principal (primeira palavra do nome) e
// não pode indicar um preparo diferente (ex.: "cru" × "cozido").
import { normalizarBusca } from "./busca";

export type CandidatoIbge = {
  id: string;
  refAlimento: string;
  medida: string;
  gramas: number;
  nomeBusca: string;
  semelhanca: number;
};

export const SUGESTOES_MAX = 8;

// Preparos, pelo radical (cozido/cozida, frito/frita...).
const PREPAROS = ["cru", "cozid", "frit", "assad", "grelhad", "refogad", "ensopad", "empanad", "torrad", "cozinhad"];

const radicalPreparo = (palavra: string) => PREPAROS.find((p) => palavra === p || palavra.startsWith(p) && palavra.length <= p.length + 2);

export function preparosDoNome(nomeNormalizado: string): Set<string> {
  const s = new Set<string>();
  for (const p of nomeNormalizado.split(" ")) {
    const r = radicalPreparo(p === "crua" ? "cru" : p);
    if (r) s.add(r);
  }
  return s;
}

/** Primeira palavra significativa do nome (ex.: "Pão, trigo, francês" → "pao"). */
export function alimentoPrincipal(nome: string): string {
  return normalizarBusca(nome).split(" ").find((p) => p.length >= 3) ?? "";
}

/** Radical simples para comparar singular e plural (pães/pão já chegam normalizados como "paes"/"pao"). */
const radical = (p: string) => p.replace(/(es|s)$/, "");

export const SEMELHANCA_MIN = 0.2;

export function filtrarSugestoes(nomeAlimento: string, candidatos: ReadonlyArray<CandidatoIbge>, limite = SUGESTOES_MAX): CandidatoIbge[] {
  const nome = normalizarBusca(nomeAlimento);
  const principal = alimentoPrincipal(nomeAlimento);
  if (!principal) return [];
  const preparos = preparosDoNome(nome);

  const validos = candidatos.filter((c) => {
    // O alimento do IBGE precisa ser o mesmo alimento principal: a primeira palavra
    // inteira tem de coincidir ("maçã" não casa com "macarrão"; "leite" não casa com "doce de leite").
    if (radical(alimentoPrincipal(c.refAlimento)) !== radical(principal)) return false;
    if (c.semelhanca < SEMELHANCA_MIN) return false;
    const preparosC = preparosDoNome(c.nomeBusca);
    // Preparo diferente do alimento (ex.: arroz cozido × "arroz cru") é descartado.
    for (const p of preparosC) if (preparos.size > 0 && !preparos.has(p)) return false;
    if (preparos.size === 0 && preparosC.size > 0 && !preparosC.has("cru")) return false;
    return true;
  });

  // Mais parecidos primeiro; uma sugestão por nome de medida.
  const ordenados = [...validos].sort((a, b) => b.semelhanca - a.semelhanca || a.gramas - b.gramas);
  const vistos = new Set<string>();
  const saida: CandidatoIbge[] = [];
  for (const c of ordenados) {
    const chave = c.medida.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(c);
    if (saida.length >= limite) break;
  }
  return saida;
}
