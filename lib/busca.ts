// Normalização de texto para a busca de alimentos (sem acentos, minúsculas,
// espaços simples). Usada na importação, no cadastro e na consulta, para que
// todos os lados comparem o mesmo formato. Sem dependências: roda no Node e no Next.

export const BUSCA_MIN = 2;
export const BUSCA_MAX = 60;
export const BUSCA_LIMITE = 20;

export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%,.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escapa os curingas do LIKE (% e _) para que o texto do usuário seja literal. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}
