import "server-only";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Barra chamadas sem user_id: nenhuma consulta roda sem o dono definido. */
export function exigirId(userId: string): void {
  if (typeof userId !== "string" || userId.length === 0 || userId.length > 200) {
    throw new Error("user_id ausente ou inválido na camada de dados.");
  }
}

export function ehUuid(id: unknown): id is string {
  return typeof id === "string" && UUID.test(id);
}
