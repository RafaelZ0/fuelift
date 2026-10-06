/** Tolerância para diferença de relógio entre o Neon Auth e o banco. */
export const TOLERANCIA_RELOGIO_MS = 5_000;

/**
 * Uma sessão vale se foi criada depois do último "encerrar sessões"
 * (troca de senha). Sem marco registrado, toda sessão vale.
 */
export function sessaoAindaValida(criadaEm: Date | string, validasDesde: Date | null): boolean {
  if (!validasDesde) return true;
  const criada = new Date(criadaEm).getTime();
  if (Number.isNaN(criada)) return false;
  return criada + TOLERANCIA_RELOGIO_MS >= validasDesde.getTime();
}
