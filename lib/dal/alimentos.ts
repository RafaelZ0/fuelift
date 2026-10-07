import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { alimentosBase, alimentosUsuario, favoritos, fontesAlimentos, type Marcacoes } from "@/lib/db/schema";
import { BUSCA_LIMITE, escaparLike, normalizarBusca, palavrasDaBusca } from "@/lib/busca";
import type { TipoAlimento } from "@/lib/validacao/comida";
import { ehUuid, exigirId } from "./util";

export type AlimentoResumo = {
  tipo: TipoAlimento;
  id: string;
  nome: string;
  marca: string | null;
  kcal: number | null;
  favorito: boolean;
  recente: boolean;
};

export type AlimentoDetalhe = {
  tipo: TipoAlimento;
  id: string;
  nome: string;
  marca: string | null;
  grupo: string | null;
  kcal: number | null;
  proteinaG: number | null;
  carboG: number | null;
  gorduraG: number | null;
  fibraG: number | null;
  sodioMg: number | null;
  marcacoes: Marcacoes;
  origem: string | null;
};

const RECENTES_DIAS = 60;
const SEMELHANCA_MIN = 0.5;

/**
 * Busca na TACO e nos alimentos do próprio usuário. Todas as palavras precisam
 * aparecer no nome, ou o nome precisa ser parecido (erros de digitação, pg_trgm).
 * Ordem: usados recentemente, favoritos, começa com o termo, mais parecido.
 */
export async function buscarAlimentos(userId: string, termo: string): Promise<AlimentoResumo[]> {
  exigirId(userId);
  const q = normalizarBusca(termo);
  const palavras = palavrasDaBusca(q);
  if (palavras.length === 0) return [];

  // Cada palavra precisa aparecer no nome, exata ou parecida (erro de digitação, pg_trgm).
  const todas = (coluna: ReturnType<typeof sql>) =>
    sql.join(
      palavras.map((p) => sql`(${coluna} like ${`%${escaparLike(p)}%`} or word_similarity(${p}, ${coluna}) >= ${SEMELHANCA_MIN})`),
      sql` and `,
    );
  // Pontuação: soma da semelhança de cada palavra (palavra exata = 1).
  const pontos = (coluna: ReturnType<typeof sql>) =>
    sql.join(
      palavras.map((p) => sql`word_similarity(${p}, ${coluna})`),
      sql` + `,
    );

  const linhas = await db.execute<{
    tipo: TipoAlimento;
    id: string;
    nome: string;
    marca: string | null;
    kcal: string | null;
    favorito: boolean;
    recente: boolean;
  }>(sql`
    with recentes as (
      select alimento_base_id, alimento_usuario_id, max(criado_em) as ultimo
      from registros_alimentares
      where user_id = ${userId} and criado_em > now() - make_interval(days => ${RECENTES_DIAS})
      group by alimento_base_id, alimento_usuario_id
    ),
    candidatos as (
      select 'base'::text as tipo, b.id, b.nome, null::text as marca, b.kcal, b.nome_busca, ${pontos(sql`b.nome_busca`)} as pontos
      from alimentos_base b
      where ${todas(sql`b.nome_busca`)}
      union all
      select 'usuario'::text, u.id, u.nome, u.marca, u.kcal, u.nome_busca, ${pontos(sql`u.nome_busca`)}
      from alimentos_usuario u
      where u.user_id = ${userId} and ${todas(sql`u.nome_busca`)}
    )
    select c.tipo, c.id, c.nome, c.marca, c.kcal,
      exists (
        select 1 from favoritos f where f.user_id = ${userId}
          and (f.alimento_base_id = c.id or f.alimento_usuario_id = c.id)
      ) as favorito,
      r.ultimo is not null as recente
    from candidatos c
    left join recentes r on (r.alimento_base_id = c.id or r.alimento_usuario_id = c.id)
    order by (r.ultimo is not null) desc, favorito desc, round(c.pontos::numeric, 1) desc,
      (c.nome_busca like ${`${escaparLike(palavras[0])}%`}) desc, length(c.nome) asc
    limit ${BUSCA_LIMITE}
  `);

  return linhas.rows.map((l) => ({ ...l, kcal: l.kcal === null ? null : Number(l.kcal) }));
}

/** Últimos alimentos usados pelo usuário (sem repetir). */
export async function listarRecentes(userId: string, limite = 15): Promise<AlimentoResumo[]> {
  exigirId(userId);
  const linhas = await db.execute<{
    tipo: TipoAlimento;
    id: string;
    nome: string;
    marca: string | null;
    kcal: string | null;
    favorito: boolean;
  }>(sql`
    with ultimos as (
      select alimento_base_id, alimento_usuario_id, max(criado_em) as ultimo
      from registros_alimentares
      where user_id = ${userId} and (alimento_base_id is not null or alimento_usuario_id is not null)
      group by alimento_base_id, alimento_usuario_id
      order by max(criado_em) desc
      limit ${limite}
    )
    select case when x.alimento_base_id is not null then 'base' else 'usuario' end as tipo,
      coalesce(b.id, u.id) as id, coalesce(b.nome, u.nome) as nome, u.marca, coalesce(b.kcal, u.kcal) as kcal,
      exists (
        select 1 from favoritos f where f.user_id = ${userId}
          and (f.alimento_base_id = x.alimento_base_id or f.alimento_usuario_id = x.alimento_usuario_id)
      ) as favorito
    from ultimos x
    left join alimentos_base b on b.id = x.alimento_base_id
    left join alimentos_usuario u on u.id = x.alimento_usuario_id and u.user_id = ${userId}
    where coalesce(b.id, u.id) is not null
    order by x.ultimo desc
  `);
  return linhas.rows.map((l) => ({ ...l, kcal: l.kcal === null ? null : Number(l.kcal), recente: true }));
}

export async function listarFavoritos(userId: string): Promise<AlimentoResumo[]> {
  exigirId(userId);
  const linhas = await db
    .select({
      baseId: alimentosBase.id,
      baseNome: alimentosBase.nome,
      baseKcal: alimentosBase.kcal,
      usuarioId: alimentosUsuario.id,
      usuarioNome: alimentosUsuario.nome,
      usuarioMarca: alimentosUsuario.marca,
      usuarioKcal: alimentosUsuario.kcal,
    })
    .from(favoritos)
    .leftJoin(alimentosBase, eq(alimentosBase.id, favoritos.alimentoBaseId))
    .leftJoin(
      alimentosUsuario,
      and(eq(alimentosUsuario.id, favoritos.alimentoUsuarioId), eq(alimentosUsuario.userId, userId)),
    )
    .where(eq(favoritos.userId, userId))
    .orderBy(desc(favoritos.criadoEm))
    .limit(50);
  return linhas
    .filter((l) => l.baseId || l.usuarioId)
    .map((l) =>
      l.baseId
        ? { tipo: "base", id: l.baseId, nome: l.baseNome!, marca: null, kcal: l.baseKcal, favorito: true, recente: false }
        : {
            tipo: "usuario",
            id: l.usuarioId!,
            nome: l.usuarioNome!,
            marca: l.usuarioMarca,
            kcal: l.usuarioKcal,
            favorito: true,
            recente: false,
          },
    );
}

/** Um alimento da TACO (público) ou do próprio usuário. Alimento de outro usuário = null. */
export async function obterAlimento(userId: string, tipo: TipoAlimento, id: string): Promise<AlimentoDetalhe | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  if (tipo === "base") {
    const [a] = await db.select().from(alimentosBase).where(eq(alimentosBase.id, id)).limit(1);
    if (!a) return null;
    return {
      tipo,
      id: a.id,
      nome: a.nome,
      marca: null,
      grupo: a.grupo,
      kcal: a.kcal,
      proteinaG: a.proteinaG,
      carboG: a.carboG,
      gorduraG: a.gorduraG,
      fibraG: a.fibraG,
      sodioMg: a.sodioMg,
      marcacoes: a.marcacoes,
      origem: null,
    };
  }
  const [a] = await db
    .select()
    .from(alimentosUsuario)
    .where(and(eq(alimentosUsuario.id, id), eq(alimentosUsuario.userId, userId)))
    .limit(1);
  if (!a) return null;
  return {
    tipo,
    id: a.id,
    nome: a.nome,
    marca: a.marca,
    grupo: null,
    kcal: a.kcal,
    proteinaG: a.proteinaG,
    carboG: a.carboG,
    gorduraG: a.gorduraG,
    fibraG: a.fibraG,
    sodioMg: a.sodioMg,
    marcacoes: {},
    origem: a.origem,
  };
}

export async function citacaoTaco(): Promise<string | null> {
  const [f] = await db
    .select({ citacao: fontesAlimentos.citacao })
    .from(fontesAlimentos)
    .where(eq(fontesAlimentos.fonte, "taco"))
    .limit(1);
  return f?.citacao ?? null;
}

// ─── Alimentos do usuário ───

export type DadosAlimentoUsuario = {
  nome: string;
  marca: string | null;
  kcal: number;
  proteinaG: number | null;
  carboG: number | null;
  gorduraG: number | null;
  fibraG: number | null;
  sodioMg: number | null;
};

export async function listarMeusAlimentos(userId: string) {
  exigirId(userId);
  return db
    .select({ id: alimentosUsuario.id, nome: alimentosUsuario.nome, marca: alimentosUsuario.marca, kcal: alimentosUsuario.kcal })
    .from(alimentosUsuario)
    .where(eq(alimentosUsuario.userId, userId))
    .orderBy(asc(alimentosUsuario.nome))
    .limit(500);
}

export async function criarAlimentoUsuario(userId: string, dados: DadosAlimentoUsuario): Promise<string> {
  exigirId(userId);
  const [a] = await db
    .insert(alimentosUsuario)
    .values({ ...dados, userId, nomeBusca: normalizarBusca(`${dados.nome} ${dados.marca ?? ""}`), origem: "rotulo" })
    .returning({ id: alimentosUsuario.id });
  return a.id;
}

export async function atualizarAlimentoUsuario(userId: string, id: string, dados: DadosAlimentoUsuario): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const linhas = await db
    .update(alimentosUsuario)
    .set({ ...dados, nomeBusca: normalizarBusca(`${dados.nome} ${dados.marca ?? ""}`), atualizadoEm: sql`now()` })
    .where(and(eq(alimentosUsuario.id, id), eq(alimentosUsuario.userId, userId)))
    .returning({ id: alimentosUsuario.id });
  return linhas.length === 1;
}

/** Apaga o alimento do usuário. Registros antigos ficam (com o snapshot), só perdem o vínculo. */
export async function excluirAlimentoUsuario(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const linhas = await db
    .delete(alimentosUsuario)
    .where(and(eq(alimentosUsuario.id, id), eq(alimentosUsuario.userId, userId)))
    .returning({ id: alimentosUsuario.id });
  return linhas.length === 1;
}
