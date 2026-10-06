import "server-only";

import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { limites } from "@/lib/db/schema";

/**
 * Conta uma tentativa para `chave` na janela atual e diz se ainda está dentro
 * do limite. Janela fixa: o contador zera a cada `janelaSegundos`.
 * A chave deve ser um hash (ver lib/limites.ts), nunca e-mail ou IP.
 */
export async function consumirLimite(
  chave: string,
  maximo: number,
  janelaSegundos: number,
): Promise<boolean> {
  const inicio = Math.floor(Date.now() / 1000 / janelaSegundos) * janelaSegundos;
  const janela = new Date(inicio * 1000);

  const [linha] = await db
    .insert(limites)
    .values({ chave, janela, contagem: 1 })
    .onConflictDoUpdate({
      target: [limites.chave, limites.janela],
      set: { contagem: sql`${limites.contagem} + 1` },
    })
    .returning({ contagem: limites.contagem });

  // Limpeza ocasional de janelas antigas.
  if (Math.random() < 0.02) {
    await db.delete(limites).where(lt(limites.janela, sql`now() - interval '2 days'`));
  }

  return linha.contagem <= maximo;
}
