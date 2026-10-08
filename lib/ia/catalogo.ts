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

export type CandidatoFoto = { id: string; nomeEn: string };

/** Só liga sozinho quando as palavras do nome são praticamente as mesmas; abaixo disso o usuário escolhe. */
export const PARECIDO_MINIMO = 0.75;

function palavrasDoNome(nome: string): Set<string> {
  return new Set(normalizarBusca(nome).split(" ").filter(Boolean));
}

/** Semelhança entre dois nomes = palavras em comum / palavras no total (0 a 1). */
export function parecido(a: string, b: string): number {
  const pa = palavrasDoNome(a);
  const pb = palavrasDoNome(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns++;
  return comuns / (pa.size + pb.size - comuns);
}

/** Escolhe o candidato mais parecido com o nome buscado, ou null se nenhum for parecido o bastante. */
export function melhorCandidato(nomeBuscado: string, candidatos: ReadonlyArray<CandidatoFoto>): CandidatoFoto | null {
  let melhor: CandidatoFoto | null = null;
  let nota = 0;
  for (const c of candidatos) {
    const n = parecido(nomeBuscado, c.nomeEn);
    if (n > nota || (n === nota && melhor && c.nomeEn.length < melhor.nomeEn.length)) {
      melhor = c;
      nota = n;
    }
  }
  return melhor && nota >= PARECIDO_MINIMO ? melhor : null;
}
