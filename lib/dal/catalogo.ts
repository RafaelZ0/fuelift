import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogoExercicios } from "@/lib/db/schema";
import { escaparLike, normalizarBusca } from "@/lib/busca";
import { melhorCandidato, termoParaCatalogo, type CandidatoFoto } from "@/lib/ia/catalogo";

// O catálogo é público (domínio público) e o app só lê; não há user_id aqui.

export type ResultadoCatalogo = { id: string; nomeEn: string; equipamento: string | null };

/** Busca por nome (aceita português: termos comuns são traduzidos). Todas as palavras precisam aparecer. */
export async function buscarNoCatalogo(termo: string, limite = 12): Promise<ResultadoCatalogo[]> {
  const palavras = termoParaCatalogo(termo);
  if (palavras.length === 0) return [];
  const condicoes = palavras.map((p) => sql`${catalogoExercicios.nomeBusca} like ${"%" + escaparLike(p) + "%"}`);
  return db
    .select({ id: catalogoExercicios.id, nomeEn: catalogoExercicios.nomeEn, equipamento: catalogoExercicios.equipamento })
    .from(catalogoExercicios)
    .where(and(eq(catalogoExercicios.temFotos, true), ...condicoes))
    .orderBy(sql`length(${catalogoExercicios.nomeBusca})`, catalogoExercicios.nomeEn)
    .limit(Math.min(Math.max(limite, 1), 30));
}

export async function nomeDoCatalogo(id: string): Promise<string | null> {
  const [r] = await db
    .select({ nomeEn: catalogoExercicios.nomeEn })
    .from(catalogoExercicios)
    .where(and(eq(catalogoExercicios.id, id), eq(catalogoExercicios.temFotos, true)))
    .limit(1);
  return r?.nomeEn ?? null;
}

/** Quais destes ids existem no catálogo e têm as duas fotos (usado para descartar ids inventados). */
export async function idsComFoto(ids: string[]): Promise<Set<string>> {
  const unicos = [...new Set(ids)].slice(0, 200);
  if (unicos.length === 0) return new Set();
  const l = await db
    .select({ id: catalogoExercicios.id })
    .from(catalogoExercicios)
    .where(and(inArray(catalogoExercicios.id, unicos), eq(catalogoExercicios.temFotos, true)));
  return new Set(l.map((x) => x.id));
}

/** Melhor correspondência do catálogo para cada nome em inglês (uma consulta só). Só liga se o nome for muito parecido. */
export async function ligarAoCatalogo(nomesEn: string[]): Promise<Array<{ id: string; nomeEn: string } | null>> {
  const normalizados = nomesEn.map((n) => normalizarBusca(n).slice(0, 120));
  if (normalizados.every((n) => n === "")) return nomesEn.map(() => null);
  const lista = sql.join(normalizados.map((n) => sql`${n}`), sql`, `);
  const r = await db.execute(sql`
    select q.i::int as i, m.id, m.nome_en
    from unnest(array[${lista}]::text[]) with ordinality as q(n, i)
    cross join lateral (
      select c.id, c.nome_en
      from catalogo_exercicios c
      where c.tem_fotos and q.n <> '' and c.nome_busca % q.n
      order by similarity(c.nome_busca, q.n) desc, length(c.nome_busca)
      limit 6
    ) m`);
  const porIndice = new Map<number, CandidatoFoto[]>();
  for (const l of r.rows as Array<{ i: number; id: string; nome_en: string }>) {
    porIndice.set(l.i, [...(porIndice.get(l.i) ?? []), { id: l.id, nomeEn: l.nome_en }]);
  }
  return nomesEn.map((nome, idx) => melhorCandidato(nome, porIndice.get(idx + 1) ?? []));
}
