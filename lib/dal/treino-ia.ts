import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agendaTreino, exercicios, planosTreino, treinoExercicios, treinos } from "@/lib/db/schema";
import { normalizarBusca } from "@/lib/busca";
import type { PlanoParaGravar } from "@/lib/ia/plano";
import { exigirId } from "./util";

/** Nome normalizado → id dos exercícios que o usuário já tem (para reaproveitar). */
export async function exerciciosPorNome(userId: string): Promise<Map<string, string>> {
  exigirId(userId);
  const l = await db.select({ id: exercicios.id, nome: exercicios.nome }).from(exercicios).where(eq(exercicios.userId, userId)).limit(500);
  return new Map(l.map((e) => [normalizarBusca(e.nome), e.id]));
}

/**
 * Grava o plano inteiro de uma vez (um único lote: tudo ou nada). O plano anterior fica guardado como
 * inativo e a agenda é recriada. O banco confere (FK por id + user_id) que tudo pertence ao usuário.
 */
export async function gravarPlanoCompleto(userId: string, p: PlanoParaGravar): Promise<string> {
  exigirId(userId);
  const dono = <T extends object>(l: T[]) => l.map((x) => ({ ...x, userId }));
  await db.batch([
    db.update(planosTreino).set({ ativo: false }).where(eq(planosTreino.userId, userId)),
    db.delete(agendaTreino).where(eq(agendaTreino.userId, userId)),
    db.insert(planosTreino).values({ ...p.plano, userId, ativo: true }),
    ...(p.exerciciosNovos.length ? [db.insert(exercicios).values(dono(p.exerciciosNovos))] : []),
    db.insert(treinos).values(dono(p.treinos.map((t) => ({ ...t, planoId: p.plano.id })))),
    ...(p.itens.length ? [db.insert(treinoExercicios).values(dono(p.itens))] : []),
    ...(p.agenda.length ? [db.insert(agendaTreino).values(dono(p.agenda))] : []),
  ]);
  return p.plano.id;
}
