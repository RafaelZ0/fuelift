// Token pessoal da API de passos. O token só existe em claro na tela, uma vez; o banco guarda o hash.
import { createHash, randomBytes } from "node:crypto";

export const PREFIXO_TOKEN = "kly_";
// 32 bytes aleatórios em base64url = 43 caracteres.
const FORMATO = /^kly_[A-Za-z0-9_-]{43}$/;

export function gerarToken(): string {
  return PREFIXO_TOKEN + randomBytes(32).toString("base64url");
}

export function formatoDeTokenValido(t: unknown): t is string {
  return typeof t === "string" && FORMATO.test(t);
}

/** SHA-256 em hexadecimal. O token tem 256 bits de entropia, então um hash simples basta (sem sal). */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Extrai o token de "Authorization: Bearer <token>" (ou null). */
export function tokenDoCabecalho(cabecalho: string | null): string | null {
  if (!cabecalho) return null;
  const m = /^Bearer ([^\s]+)$/.exec(cabecalho.trim());
  return m && formatoDeTokenValido(m[1]) ? m[1] : null;
}
