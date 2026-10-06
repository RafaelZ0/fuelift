import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { consumirLimite } from "@/lib/dal/limites";

const MINUTO = 60;

// Limites por ação. Valores conservadores para um app pessoal.
export const LIMITES = {
  entrarPorEmail: { maximo: 5, janela: 15 * MINUTO },
  entrarPorIp: { maximo: 20, janela: 15 * MINUTO },
  cadastroPorIp: { maximo: 5, janela: 60 * MINUTO },
  verificarPorEmail: { maximo: 5, janela: 15 * MINUTO },
  reenviarPorEmail: { maximo: 3, janela: 60 * MINUTO },
} as const;

/** Hash com chave secreta: a tabela nunca guarda e-mail ou IP legíveis. */
function chave(tipo: string, valor: string): string {
  const segredo = process.env.NEON_AUTH_COOKIE_SECRET ?? "";
  const hash = createHmac("sha256", `fuelift-limites:${segredo}`)
    .update(valor.toLowerCase())
    .digest("base64url");
  return `${tipo}:${hash}`;
}

export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
}

/** Retorna true se TODOS os limites ainda permitem a ação. */
export async function dentroDoLimite(
  verificacoes: Array<{ tipo: keyof typeof LIMITES; valor: string }>,
): Promise<boolean> {
  let permitido = true;
  for (const { tipo, valor } of verificacoes) {
    const { maximo, janela } = LIMITES[tipo];
    if (!(await consumirLimite(chave(tipo, valor), maximo, janela))) permitido = false;
  }
  return permitido;
}
