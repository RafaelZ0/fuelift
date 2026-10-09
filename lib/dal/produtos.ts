import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { alimentosUsuario, produtosBarras, type ProdutoBarras } from "@/lib/db/schema";
import { normalizarBusca } from "@/lib/busca";
import type { ProdutoExtraido } from "@/lib/barras";
import { exigirId } from "./util";

// Cache compartilhado do Open Food Facts: sem user_id (é dado público e nunca guarda quem consultou).
// A cópia que o usuário usa no diário é um alimento DELE (alimentos_usuario), privado e editável.

export async function obterProdutoEmCache(codigo: string): Promise<ProdutoBarras | null> {
  const [p] = await db.select().from(produtosBarras).where(eq(produtosBarras.codigo, codigo)).limit(1);
  return p ?? null;
}

export async function guardarProdutoEmCache(codigo: string, p: ProdutoExtraido): Promise<void> {
  const valores =
    p.status === "nao_encontrado"
      ? { codigo, status: "nao_encontrado" as const, nome: null, marca: null, quantidade: null, porcaoG: null, kcal: null, proteinaG: null, carboG: null, gorduraG: null, fibraG: null, sodioMg: null, incompleto: false, suspeito: false }
      : {
          codigo,
          status: "encontrado" as const,
          nome: p.nome,
          marca: p.marca,
          quantidade: p.quantidade,
          porcaoG: p.porcaoG,
          kcal: p.nutrientes.kcal,
          proteinaG: p.nutrientes.proteinaG,
          carboG: p.nutrientes.carboG,
          gorduraG: p.nutrientes.gorduraG,
          fibraG: p.nutrientes.fibraG,
          sodioMg: p.nutrientes.sodioMg,
          incompleto: p.incompleto,
          suspeito: p.suspeito,
        };
  const atualizar: Omit<typeof valores, "codigo"> & Partial<Pick<typeof valores, "codigo">> = { ...valores };
  delete atualizar.codigo;
  await db
    .insert(produtosBarras)
    .values(valores)
    .onConflictDoUpdate({ target: produtosBarras.codigo, set: { ...atualizar, consultadoEm: new Date() } });
}

/** Alimento do usuário já criado a partir deste código (um por código e por usuário). */
export async function alimentoDoCodigo(userId: string, codigo: string): Promise<string | null> {
  exigirId(userId);
  const [a] = await db
    .select({ id: alimentosUsuario.id })
    .from(alimentosUsuario)
    .where(and(eq(alimentosUsuario.userId, userId), eq(alimentosUsuario.codigoBarras, codigo)))
    .limit(1);
  return a?.id ?? null;
}

/** Copia o produto do cache para os alimentos do usuário (se ainda não existir) e devolve o id. Exige calorias. */
export async function copiarProdutoParaUsuario(userId: string, p: ProdutoBarras): Promise<string | null> {
  exigirId(userId);
  if (p.status !== "encontrado" || !p.nome || p.kcal === null) return null;
  const existente = await alimentoDoCodigo(userId, p.codigo);
  if (existente) return existente;
  const [a] = await db
    .insert(alimentosUsuario)
    .values({
      userId,
      nome: p.nome,
      nomeBusca: normalizarBusca(`${p.nome} ${p.marca ?? ""}`),
      marca: p.marca,
      kcal: p.kcal,
      proteinaG: p.proteinaG,
      carboG: p.carboG,
      gorduraG: p.gorduraG,
      fibraG: p.fibraG,
      sodioMg: p.sodioMg,
      origem: "codigo_barras",
      codigoBarras: p.codigo,
    })
    .onConflictDoNothing()
    .returning({ id: alimentosUsuario.id });
  return a?.id ?? (await alimentoDoCodigo(userId, p.codigo));
}
