// Busca de foto no catálogo (nomes em inglês). Funções puras: o usuário digita em português,
// então termos comuns são traduzidos antes de consultar. O que não estiver na lista é buscado como veio.
import { normalizarBusca, palavrasDaBusca } from "@/lib/busca";

const TERMOS: ReadonlyArray<readonly [string, string]> = [
  ["supino", "bench press"],
  ["agachamento", "squat"],
  ["afundo", "lunge"],
  ["avanco", "lunge"],
  ["remada", "row"],
  ["rosca", "curl"],
  ["puxada", "pulldown"],
  ["barra fixa", "pull up"],
  ["triceps", "triceps"],
  ["biceps", "biceps"],
  ["desenvolvimento", "shoulder press"],
  ["elevacao lateral", "lateral raise"],
  ["elevacao frontal", "front raise"],
  ["levantamento terra", "deadlift"],
  ["stiff", "stiff leg deadlift"],
  ["panturrilha", "calf raise"],
  ["abdominal", "crunch"],
  ["prancha", "plank"],
  ["flexao", "push up"],
  ["crucifixo", "fly"],
  ["leg press", "leg press"],
  ["cadeira extensora", "leg extension"],
  ["mesa flexora", "leg curl"],
  ["gluteo", "glute"],
  ["ponte", "bridge"],
  ["encolhimento", "shrug"],
  ["peito", "chest"],
  ["costas", "back"],
  ["ombro", "shoulder"],
  ["perna", "leg"],
  ["halter", "dumbbell"],
  ["halteres", "dumbbell"],
  ["barra", "barbell"],
  ["polia", "cable"],
  ["maquina", "machine"],
  ["inclinado", "incline"],
  ["declinado", "decline"],
  ["sentado", "seated"],
  ["em pe", "standing"],
];

const LIGACOES = new Set(["com", "de", "da", "do", "na", "no", "e", "para"]);

/** Termo digitado → palavras para consultar o catálogo (traduz termos comuns de PT para EN). */
export function termoParaCatalogo(digitado: string): string[] {
  let t = ` ${normalizarBusca(digitado)} `;
  for (const [pt, en] of TERMOS) t = t.replaceAll(` ${pt} `, ` ${en} `);
  return palavrasDaBusca(normalizarBusca(t)).filter((p) => !LIGACOES.has(p));
}

export type CandidatoFoto = { id: string; nomeEn: string; similaridade: number };

/** Só liga sozinho quando a semelhança é alta; abaixo disso o usuário escolhe. */
export const SIMILARIDADE_LIGACAO = 0.6;

export function escolherLigacao(candidato: CandidatoFoto | undefined): CandidatoFoto | null {
  return candidato && candidato.similaridade >= SIMILARIDADE_LIGACAO ? candidato : null;
}
