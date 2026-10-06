import "server-only";

/**
 * Registra um erro no log do servidor sem dados pessoais: só o contexto, o
 * tipo do erro e o código do Postgres/Neon Auth. A mensagem original não é
 * registrada porque pode conter valores enviados pelo usuário.
 */
export function registrarErro(contexto: string, erro: unknown): void {
  const e = erro as { name?: unknown; code?: unknown; status?: unknown } | null;
  console.error(
    JSON.stringify({
      contexto,
      tipo: typeof e?.name === "string" ? e.name : typeof erro,
      codigo: typeof e?.code === "string" ? e.code : undefined,
      status: typeof e?.status === "number" ? e.status : undefined,
    }),
  );
}
