import "server-only";

import { headers } from "next/headers";
import { consumirLimite } from "@/lib/dal/limites";
import { chaveDoLimite, chaveHmacLimites } from "@/lib/regras-limites";

const MINUTO = 60;

// Limites por ação. Valores conservadores para um app pessoal.
export const LIMITES = {
  entrarPorEmail: { maximo: 5, janela: 15 * MINUTO },
  entrarPorIp: { maximo: 20, janela: 15 * MINUTO },
  cadastroPorIp: { maximo: 5, janela: 60 * MINUTO },
  verificarPorEmail: { maximo: 5, janela: 15 * MINUTO },
  reenviarPorEmail: { maximo: 3, janela: 60 * MINUTO },
  recuperarPorEmail: { maximo: 3, janela: 60 * MINUTO },
  novaSenhaPorEmail: { maximo: 5, janela: 15 * MINUTO },
  buscaPorUsuario: { maximo: 120, janela: MINUTO },
  barrasPorUsuario: { maximo: 30, janela: MINUTO },
} as const;

export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
}

/** Retorna true se TODOS os limites ainda permitem a ação. */
export async function dentroDoLimite(
  verificacoes: Array<{ tipo: keyof typeof LIMITES; valor: string }>,
): Promise<boolean> {
  const chave = chaveHmacLimites(process.env.LIMITES_HMAC_KEY);
  let permitido = true;
  for (const { tipo, valor } of verificacoes) {
    const { maximo, janela } = LIMITES[tipo];
    if (!(await consumirLimite(chaveDoLimite(tipo, valor, chave), maximo, janela))) permitido = false;
  }
  return permitido;
}
