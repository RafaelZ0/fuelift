import "server-only";

import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { perfis, usoIa } from "@/lib/db/schema";
import { LIMITE_DIARIO, type TipoUsoIa } from "@/lib/ia/config";
import { exigirId } from "./util";

export async function obterAceiteIa(userId: string): Promise<{ versao: number; em: Date } | null> {
  exigirId(userId);
  const [p] = await db.select({ versao: perfis.iaAceiteVersao, em: perfis.iaAceiteEm }).from(perfis).where(eq(perfis.userId, userId)).limit(1);
  return p?.versao != null && p.em ? { versao: p.versao, em: p.em } : null;
}

export async function registrarAceiteIa(userId: string, versao: number): Promise<void> {
  exigirId(userId);
  await db.update(perfis).set({ iaAceiteVersao: versao, iaAceiteEm: sql`now()` }).where(eq(perfis.userId, userId));
}

/**
 * Conta uma chamada à IA do dia, de forma atômica: só incrementa se ainda houver saldo.
 * Devolve false quando o limite diário já foi atingido (nada é contado nesse caso).
 */
export async function consumirUsoIa(userId: string, data: string, tipo: TipoUsoIa): Promise<boolean> {
  exigirId(userId);
  const limite = LIMITE_DIARIO[tipo];
  const r = await db
    .insert(usoIa)
    .values({ userId, data, tipo, chamadas: 1 })
    .onConflictDoUpdate({
      target: [usoIa.userId, usoIa.data, usoIa.tipo],
      set: { chamadas: sql`${usoIa.chamadas} + 1` },
      setWhere: lt(usoIa.chamadas, limite),
    })
    .returning({ chamadas: usoIa.chamadas });
  return r.length === 1;
}

/** Devolve a chamada quando a IA falhou por motivo nosso ou do provedor (não gasta o saldo do usuário). */
export async function devolverUsoIa(userId: string, data: string, tipo: TipoUsoIa): Promise<void> {
  exigirId(userId);
  await db
    .update(usoIa)
    .set({ chamadas: sql`greatest(${usoIa.chamadas} - 1, 0)` })
    .where(and(eq(usoIa.userId, userId), eq(usoIa.data, data), eq(usoIa.tipo, tipo)));
}

export async function usoDoDia(userId: string, data: string, tipo: TipoUsoIa): Promise<{ usadas: number; limite: number }> {
  exigirId(userId);
  const [r] = await db
    .select({ c: usoIa.chamadas })
    .from(usoIa)
    .where(and(eq(usoIa.userId, userId), eq(usoIa.data, data), eq(usoIa.tipo, tipo)))
    .limit(1);
  return { usadas: r?.c ?? 0, limite: LIMITE_DIARIO[tipo] };
}
