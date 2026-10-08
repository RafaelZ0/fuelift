// Fotos dos exercícios: Free Exercise DB (github.com/yuhonas/free-exercise-db), domínio público (The Unlicense).
// Cada exercício tem 2 imagens (posição inicial e final). O app guarda só o id; a imagem vem do repositório.

export const FOTOS_ORIGEM = "https://raw.githubusercontent.com";
const BASE = `${FOTOS_ORIGEM}/yuhonas/free-exercise-db/main/exercises/`;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,120}$/;

export function fotoIdValido(fotoId: string | null | undefined): fotoId is string {
  return typeof fotoId === "string" && ID_VALIDO.test(fotoId);
}

/** URL da imagem (0 = início, 1 = fim) ou null se o id for inválido. */
export function urlFoto(fotoId: string | null | undefined, n: 0 | 1 = 0): string | null {
  return fotoIdValido(fotoId) ? `${BASE}${fotoId}/${n}.jpg` : null;
}

export const CREDITO_FOTOS = "Fotos: Free Exercise DB (domínio público).";
