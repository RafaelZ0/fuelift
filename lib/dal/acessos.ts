import "server-only";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { acessos, type Acesso } from "@/lib/db/schema";
import { exigirId } from "./util";

/** Prova de que a sessão atual é de administrador. Só é criada em lib/auth/sessao.ts. */
export type Administrador = { readonly userId: string; readonly __admin: true };

export type StatusAcesso = "pendente" | "aprovado" | "recusado";

/**
 * Registra o usuário no primeiro acesso como "pendente". Administradores são
 * aprovados automaticamente. Nunca altera a decisão já tomada para os demais.
 */
export async function registrarAcesso(
  userId: string,
  email: string,
  administrador: boolean,
): Promise<Acesso> {
  exigirId(userId);
  const valores = {
    userId,
    email: email.slice(0, 320),
    status: administrador ? "aprovado" : "pendente",
    decididoEm: administrador ? sql`now()` : null,
  };
  const consulta = db.insert(acessos).values(valores);
  const [linha] = administrador
    ? await consulta
        .onConflictDoUpdate({ target: acessos.userId, set: { status: "aprovado" } })
        .returning()
    : await consulta.onConflictDoNothing({ target: acessos.userId }).returning();
  if (linha) return linha;

  const [existente] = await db.select().from(acessos).where(eq(acessos.userId, userId)).limit(1);
  return existente;
}

export async function listarPendentes(admin: Administrador): Promise<Acesso[]> {
  exigirId(admin.userId);
  return db
    .select()
    .from(acessos)
    .where(eq(acessos.status, "pendente"))
    .orderBy(asc(acessos.criadoEm))
    .limit(50);
}

/** Aprova ou recusa outro usuário. O administrador não altera o próprio acesso. */
export async function decidirAcesso(
  admin: Administrador,
  alvoUserId: string,
  status: Exclude<StatusAcesso, "pendente">,
): Promise<boolean> {
  exigirId(admin.userId);
  exigirId(alvoUserId);
  const linhas = await db
    .update(acessos)
    .set({ status, decididoEm: sql`now()` })
    .where(and(eq(acessos.userId, alvoUserId), ne(acessos.userId, admin.userId)))
    .returning({ userId: acessos.userId });
  return linhas.length === 1;
}
