import "server-only";

import { obterAceiteIa } from "@/lib/dal/ia";
import { disponibilidadeIa } from "./config";
import { VERSAO_ACEITE_IA } from "./prompts";

export type AcessoIa = { ok: true } | { ok: false; erro: string; precisaAceite?: boolean };

/** Verificações comuns de qualquer chamada à IA: chave configurada, modo só administrador e aceite do aviso. */
export async function verificarAcessoIa(userId: string, ehAdmin: boolean): Promise<AcessoIa> {
  const d = disponibilidadeIa(
    { GEMINI_API_KEY: process.env.GEMINI_API_KEY, IA_SOMENTE_ADMIN: process.env.IA_SOMENTE_ADMIN, IA_PLANO: process.env.IA_PLANO },
    ehAdmin,
  );
  if (!d.ok) return { ok: false, erro: d.motivo === "somente_admin" ? "A IA está liberada só para o administrador por enquanto." : "A IA ainda não está ativada neste app." };
  const aceite = await obterAceiteIa(userId);
  if (!aceite || aceite.versao < VERSAO_ACEITE_IA) {
    return { ok: false, erro: "Antes de usar a IA, leia e aceite o aviso.", precisaAceite: true };
  }
  return { ok: true };
}
