// Regras de uso da IA (limites e quem pode usar). Puro: recebe o ambiente como argumento.
export const LIMITE_DIARIO = { plano: 5, importacao: 5 } as const;
export type TipoUsoIa = keyof typeof LIMITE_DIARIO;

export const LIMITES_ARQUIVO = { quantidade: 4, bytesPorArquivo: 4 * 1024 * 1024, bytesTotal: 6 * 1024 * 1024 } as const;

export type AmbienteIa = { GEMINI_API_KEY?: string; IA_SOMENTE_ADMIN?: string; IA_PLANO?: string };

export type DisponibilidadeIa = { ok: true } | { ok: false; motivo: "sem_chave" | "somente_admin" | "plano_pago_nao_confirmado" };

/**
 * A IA só liga com chave configurada. IA_SOMENTE_ADMIN=true restringe ao administrador.
 * IA_PLANO deve ser "gratuito" ou "pago": o plano gratuito pode ser lido por revisores e usado para
 * melhorar produtos, por isso a tela de aceite avisa; sem IA_PLANO o app assume o gratuito (mais cauteloso).
 */
export function disponibilidadeIa(env: AmbienteIa, ehAdmin: boolean): DisponibilidadeIa {
  if (!env.GEMINI_API_KEY) return { ok: false, motivo: "sem_chave" };
  if (env.IA_SOMENTE_ADMIN === "true" && !ehAdmin) return { ok: false, motivo: "somente_admin" };
  return { ok: true };
}

export const planoGratuito = (env: AmbienteIa) => env.IA_PLANO !== "pago";

// Bytes iniciais de cada formato: o tipo declarado pelo navegador não é confiável.
export function tipoPeloConteudo(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null {
  const eq = (inicio: number[], desloc = 0) => inicio.every((v, i) => b[desloc + i] === v);
  if (b.length < 12) return null;
  if (eq([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (eq([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (eq([0x52, 0x49, 0x46, 0x46]) && eq([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (eq([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}
