import { createHmac } from "node:crypto";

export const TAMANHO_MINIMO_CHAVE = 32;

/** Lê a chave do HMAC. Falha fechada: sem chave válida, lança erro. */
export function chaveHmacLimites(valor = process.env.LIMITES_HMAC_KEY): string {
  if (!valor || valor.length < TAMANHO_MINIMO_CHAVE) {
    throw new Error("LIMITES_HMAC_KEY ausente ou com menos de 32 caracteres.");
  }
  return valor;
}

/** HMAC-SHA256 com chave própria: a tabela nunca guarda e-mail ou IP legíveis. */
export function chaveDoLimite(tipo: string, valor: string, chave: string): string {
  const hash = createHmac("sha256", chave).update(`${tipo}:${valor.toLowerCase()}`).digest("base64url");
  return `${tipo}:${hash}`;
}
