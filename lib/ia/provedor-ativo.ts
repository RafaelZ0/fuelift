import "server-only";

import { criarProvedorGemini } from "./gemini";
import { ErroIa, type ProvedorIa } from "./provedor";

let deTeste: ProvedorIa | null = null;

/** Só os testes trocam o provedor (fica fora do arquivo de Server Actions para não virar endpoint). */
export function definirProvedorDeTeste(p: ProvedorIa | null): void {
  deTeste = p;
}

export function obterProvedor(): ProvedorIa {
  if (deTeste) return deTeste;
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) throw new ErroIa("config");
  return criarProvedorGemini(chave, process.env.GEMINI_MODEL || undefined);
}
