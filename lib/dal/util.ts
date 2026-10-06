import "server-only";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(id: unknown): id is string {
  return typeof id === "string" && UUID.test(id);
}

/** Barra chamadas sem user_id válido (uuid do Neon Auth): nenhuma consulta roda sem o dono definido. */
export function exigirId(userId: string): void {
  if (!ehUuid(userId)) {
    throw new Error("user_id ausente ou inválido na camada de dados.");
  }
}
