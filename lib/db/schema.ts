import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// user_id = id do usuário no Neon Auth (uuid, conferido em neon_auth.user). Sem FK para neon_auth,
// porque o papel do app não tem acesso àquele schema.

export const perfis = pgTable(
  "perfis",
  {
    userId: uuid("user_id").primaryKey(),
    nome: text("nome"),
    dataNascimento: date("data_nascimento"),
    sexo: text("sexo"),
    alturaCm: numeric("altura_cm", { precision: 4, scale: 1, mode: "number" }),
    nivelAtividade: text("nivel_atividade"),
    inicioPlano: date("inicio_plano"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("perfis_nome_check", sql`char_length(${t.nome}) <= 80`),
    check("perfis_data_nascimento_check", sql`${t.dataNascimento} >= date '1900-01-01'`),
    check("perfis_sexo_check", sql`${t.sexo} in ('masculino', 'feminino')`),
    check("perfis_altura_cm_check", sql`${t.alturaCm} between 100 and 250`),
    check(
      "perfis_nivel_atividade_check",
      sql`${t.nivelAtividade} in ('sedentario', 'leve', 'moderado', 'alto', 'muito_alto')`,
    ),
  ],
);

export const metas = pgTable(
  "metas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => perfis.userId, { onDelete: "cascade" }),
    vigenteDesde: date("vigente_desde").notNull(),
    kcal: integer("kcal"),
    proteinaG: integer("proteina_g"),
    carboG: integer("carbo_g"),
    gorduraG: integer("gordura_g"),
    aguaMl: integer("agua_ml"),
    pesoMetaKg: numeric("peso_meta_kg", { precision: 5, scale: 1, mode: "number" }),
    dataMeta: date("data_meta"),
    observacao: text("observacao"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("metas_user_id_vigente_desde_key").on(t.userId, t.vigenteDesde),
    index("metas_user_vigencia").on(t.userId, t.vigenteDesde.desc()),
    check("metas_kcal_check", sql`${t.kcal} between 500 and 10000`),
    check("metas_proteina_g_check", sql`${t.proteinaG} between 0 and 500`),
    check("metas_carbo_g_check", sql`${t.carboG} between 0 and 1500`),
    check("metas_gordura_g_check", sql`${t.gorduraG} between 0 and 500`),
    check("metas_agua_ml_check", sql`${t.aguaMl} between 0 and 10000`),
    check("metas_peso_meta_kg_check", sql`${t.pesoMetaKg} between 20 and 400`),
    check("metas_observacao_check", sql`char_length(${t.observacao}) <= 500`),
  ],
);

// Autorização de cadastro: todo usuário novo fica "pendente" até o
// administrador aprovar.
export const acessos = pgTable(
  "acessos",
  {
    userId: uuid("user_id").primaryKey(),
    email: text("email").notNull(),
    status: text("status").notNull().default("pendente"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    decididoEm: timestamp("decidido_em", { withTimezone: true }),
    // Sessões criadas antes deste instante são recusadas pelo app
    // (preenchido quando a senha é trocada).
    sessoesValidasDesde: timestamp("sessoes_validas_desde", { withTimezone: true }),
  },
  (t) => [
    check("acessos_email_check", sql`char_length(${t.email}) <= 320`),
    check("acessos_status_check", sql`${t.status} in ('pendente', 'aprovado', 'recusado')`),
    index("acessos_status").on(t.status),
    index("acessos_email").on(t.email),
  ],
);

// Contador de tentativas por janela de tempo (seção 5 do SEGURANCA.md).
// A chave é sempre um HMAC: nunca guarda e-mail ou IP em texto.
export const limites = pgTable(
  "limites",
  {
    chave: text("chave").notNull(),
    janela: timestamp("janela", { withTimezone: true }).notNull(),
    contagem: integer("contagem").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.chave, t.janela] }), index("limites_janela").on(t.janela)],
);

export type Perfil = typeof perfis.$inferSelect;
export type Meta = typeof metas.$inferSelect;
export type Acesso = typeof acessos.$inferSelect;

// ───────────────────────── Fase 2: alimentos e diário ─────────────────────────

const n72 = { precision: 7, scale: 2, mode: "number" } as const;
const n62 = { precision: 6, scale: 2, mode: "number" } as const;
const n82 = { precision: 8, scale: 2, mode: "number" } as const;

export const NUTRIENTES = ["kcal", "proteina_g", "carbo_g", "gordura_g", "fibra_g", "sodio_mg"] as const;

/** Marcação original de um nutriente na fonte (ex.: Tr, NA, *) e de onde veio o valor. */
export type Marcacoes = Partial<
  Record<(typeof NUTRIENTES)[number], { marca?: string; fonte?: string; ref?: string }>
>;

// Fontes oficiais importadas (TACO; USDA para valores complementares). Só leitura para o app.
export const fontesAlimentos = pgTable(
  "fontes_alimentos",
  {
    fonte: text("fonte").notNull(),
    edicao: text("edicao").notNull(),
    titulo: text("titulo").notNull(),
    url: text("url").notNull(),
    termos: text("termos").notNull(),
    citacao: text("citacao").notNull(),
    arquivoSha256: text("arquivo_sha256"),
    importadoEm: timestamp("importado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.fonte, t.edicao] }),
    check("fontes_alimentos_fonte_check", sql`${t.fonte} in ('taco', 'usda', 'ibge')`),
  ],
);

// Base oficial (TACO). Valores por 100 g. null = desconhecido. Só leitura para o app.
export const alimentosBase = pgTable(
  "alimentos_base",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fonte: text("fonte").notNull(),
    edicao: text("edicao").notNull(),
    codigoFonte: text("codigo_fonte").notNull(),
    nome: text("nome").notNull(),
    nomeBusca: text("nome_busca").notNull(),
    grupo: text("grupo"),
    kcal: numeric("kcal", n72),
    proteinaG: numeric("proteina_g", n62),
    carboG: numeric("carbo_g", n62),
    gorduraG: numeric("gordura_g", n62),
    fibraG: numeric("fibra_g", n62),
    sodioMg: numeric("sodio_mg", n82),
    marcacoes: jsonb("marcacoes").$type<Marcacoes>().notNull().default({}),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("alimentos_base_fonte_codigo_key").on(t.fonte, t.codigoFonte),
    foreignKey({
      columns: [t.fonte, t.edicao],
      foreignColumns: [fontesAlimentos.fonte, fontesAlimentos.edicao],
    }),
    check("alimentos_base_fonte_check", sql`${t.fonte} in ('taco')`),
    check("alimentos_base_nome_check", sql`char_length(${t.nome}) between 1 and 200`),
    check("alimentos_base_kcal_check", sql`${t.kcal} between 0 and 900`),
    check("alimentos_base_proteina_check", sql`${t.proteinaG} between 0 and 100`),
    check("alimentos_base_carbo_check", sql`${t.carboG} between 0 and 100`),
    check("alimentos_base_gordura_check", sql`${t.gorduraG} between 0 and 100`),
    check("alimentos_base_fibra_check", sql`${t.fibraG} between 0 and 100`),
    check("alimentos_base_sodio_check", sql`${t.sodioMg} between 0 and 40000`),
    index("alimentos_base_nome_busca_trgm").using("gin", t.nomeBusca.op("gin_trgm_ops")),
  ],
);

// Alimentos criados pelo usuário (rótulo ou estimativa da IA confirmada). Valores por 100 g.
export const alimentosUsuario = pgTable(
  "alimentos_usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => perfis.userId, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    nomeBusca: text("nome_busca").notNull(),
    marca: text("marca"),
    kcal: numeric("kcal", n72).notNull(),
    proteinaG: numeric("proteina_g", n62),
    carboG: numeric("carbo_g", n62),
    gorduraG: numeric("gordura_g", n62),
    fibraG: numeric("fibra_g", n62),
    sodioMg: numeric("sodio_mg", n82),
    origem: text("origem").notNull().default("rotulo"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Permite que outras tabelas apontem para (id, user_id): o banco garante o mesmo dono.
    unique("alimentos_usuario_id_user_key").on(t.id, t.userId),
    index("alimentos_usuario_user").on(t.userId),
    index("alimentos_usuario_nome_busca_trgm").using("gin", t.nomeBusca.op("gin_trgm_ops")),
    check("alimentos_usuario_nome_check", sql`char_length(${t.nome}) between 1 and 120`),
    check("alimentos_usuario_marca_check", sql`char_length(${t.marca}) <= 80`),
    check("alimentos_usuario_kcal_check", sql`${t.kcal} between 0 and 900`),
    check("alimentos_usuario_proteina_check", sql`${t.proteinaG} between 0 and 100`),
    check("alimentos_usuario_carbo_check", sql`${t.carboG} between 0 and 100`),
    check("alimentos_usuario_gordura_check", sql`${t.gorduraG} between 0 and 100`),
    check("alimentos_usuario_fibra_check", sql`${t.fibraG} between 0 and 100`),
    check("alimentos_usuario_sodio_check", sql`${t.sodioMg} between 0 and 40000`),
    check(
      "alimentos_usuario_macros_check",
      sql`coalesce(${t.proteinaG}, 0) + coalesce(${t.carboG}, 0) + coalesce(${t.gorduraG}, 0) <= 100.5`,
    ),
    check("alimentos_usuario_origem_check", sql`${t.origem} in ('rotulo', 'ia_estimativa')`),
  ],
);

// Medidas referidas do IBGE (POF 2008-2009). Só leitura para o app; usadas como sugestões.
export const medidasIbge = pgTable(
  "medidas_ibge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codigoPof: text("codigo_pof").notNull(),
    descricaoPof: text("descricao_pof").notNull(),
    refAlimento: text("ref_alimento").notNull(), // ex.: "Pão francês"
    medida: text("medida").notNull(), // ex.: "unidade", "fatia média"
    gramas: numeric("gramas", n72).notNull(),
    nomeBusca: text("nome_busca").notNull(),
  },
  (t) => [
    unique("medidas_ibge_chave").on(t.refAlimento, t.medida, t.gramas),
    index("medidas_ibge_nome_busca_trgm").using("gin", t.nomeBusca.op("gin_trgm_ops")),
    check("medidas_ibge_gramas_check", sql`${t.gramas} > 0 and ${t.gramas} <= 2000`),
    check("medidas_ibge_textos_check", sql`char_length(${t.refAlimento}) between 1 and 200 and char_length(${t.medida}) between 1 and 80`),
  ],
);

// Medidas caseiras do usuário (ex.: "minha concha" = 140 g), por alimento.
export const medidas = pgTable(
  "medidas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => perfis.userId, { onDelete: "cascade" }),
    alimentoBaseId: uuid("alimento_base_id").references(() => alimentosBase.id, { onDelete: "cascade" }),
    alimentoUsuarioId: uuid("alimento_usuario_id"),
    nome: text("nome").notNull(),
    gramas: numeric("gramas", n72).notNull(),
    // "usuario" = criada pelo usuário; "ibge" = sugestão do IBGE fixada pelo usuário.
    origem: text("origem").notNull().default("usuario"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.alimentoUsuarioId, t.userId],
      foreignColumns: [alimentosUsuario.id, alimentosUsuario.userId],
    }).onDelete("cascade"),
    index("medidas_user").on(t.userId),
    check("medidas_origem_check", sql`${t.origem} in ('usuario', 'ibge')`),
    uniqueIndex("medidas_base_nome_key")
      .on(t.userId, t.alimentoBaseId, sql`lower(${t.nome})`)
      .where(sql`${t.alimentoBaseId} is not null`),
    uniqueIndex("medidas_usuario_nome_key")
      .on(t.userId, t.alimentoUsuarioId, sql`lower(${t.nome})`)
      .where(sql`${t.alimentoUsuarioId} is not null`),
    check("medidas_nome_check", sql`char_length(${t.nome}) between 1 and 40`),
    check("medidas_gramas_check", sql`${t.gramas} > 0 and ${t.gramas} <= 2000`),
    check("medidas_alimento_check", sql`num_nonnulls(${t.alimentoBaseId}, ${t.alimentoUsuarioId}) = 1`),
  ],
);

// Diário alimentar. Nutrientes em snapshot (calculados no momento do registro).
// A FK (alimento_usuario_id, user_id) com "on delete set null (alimento_usuario_id)"
// fica na migration SQL escrita à mão, porque o Drizzle não gera essa forma.
export const registrosAlimentares = pgTable(
  "registros_alimentares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => perfis.userId, { onDelete: "cascade" }),
    data: date("data").notNull(),
    refeicao: text("refeicao").notNull(),
    alimentoBaseId: uuid("alimento_base_id").references(() => alimentosBase.id, { onDelete: "set null" }),
    alimentoUsuarioId: uuid("alimento_usuario_id"),
    nome: text("nome").notNull(),
    gramas: numeric("gramas", n72).notNull(),
    medidaTexto: text("medida_texto"),
    kcal: numeric("kcal", n82).notNull(),
    proteinaG: numeric("proteina_g", n72),
    carboG: numeric("carbo_g", n72),
    gorduraG: numeric("gordura_g", n72),
    fibraG: numeric("fibra_g", n72),
    origem: text("origem").notNull().default("manual"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("registros_user_data").on(t.userId, t.data),
    index("registros_user_criado").on(t.userId, t.criadoEm.desc()),
    check("registros_refeicao_check", sql`${t.refeicao} in ('cafe', 'almoco', 'lanche', 'jantar', 'ceia')`),
    check("registros_data_check", sql`${t.data} >= date '2000-01-01'`),
    check("registros_nome_check", sql`char_length(${t.nome}) between 1 and 160`),
    check("registros_gramas_check", sql`${t.gramas} > 0 and ${t.gramas} <= 5000`),
    check("registros_medida_check", sql`char_length(${t.medidaTexto}) <= 60`),
    check("registros_kcal_check", sql`${t.kcal} between 0 and 10000`),
    check("registros_proteina_check", sql`${t.proteinaG} between 0 and 5000`),
    check("registros_carbo_check", sql`${t.carboG} between 0 and 5000`),
    check("registros_gordura_check", sql`${t.gorduraG} between 0 and 5000`),
    check("registros_fibra_check", sql`${t.fibraG} between 0 and 5000`),
    check("registros_alimento_check", sql`num_nonnulls(${t.alimentoBaseId}, ${t.alimentoUsuarioId}) <= 1`),
    check("registros_origem_check", sql`${t.origem} in ('manual', 'ia_texto', 'ia_foto', 'codigo_barras')`),
  ],
);

export const favoritos = pgTable(
  "favoritos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => perfis.userId, { onDelete: "cascade" }),
    alimentoBaseId: uuid("alimento_base_id").references(() => alimentosBase.id, { onDelete: "cascade" }),
    alimentoUsuarioId: uuid("alimento_usuario_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.alimentoUsuarioId, t.userId],
      foreignColumns: [alimentosUsuario.id, alimentosUsuario.userId],
    }).onDelete("cascade"),
    uniqueIndex("favoritos_base_key").on(t.userId, t.alimentoBaseId).where(sql`${t.alimentoBaseId} is not null`),
    uniqueIndex("favoritos_usuario_key")
      .on(t.userId, t.alimentoUsuarioId)
      .where(sql`${t.alimentoUsuarioId} is not null`),
    check("favoritos_alimento_check", sql`num_nonnulls(${t.alimentoBaseId}, ${t.alimentoUsuarioId}) = 1`),
  ],
);

export const refeicoesSalvas = pgTable(
  "refeicoes_salvas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => perfis.userId, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("refeicoes_salvas_id_user_key").on(t.id, t.userId),
    index("refeicoes_salvas_user").on(t.userId),
    check("refeicoes_salvas_nome_check", sql`char_length(${t.nome}) between 1 and 80`),
  ],
);

// Itens guardam user_id para que o banco garanta o mesmo dono da refeição e do alimento.
export const refeicoesSalvasItens = pgTable(
  "refeicoes_salvas_itens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refeicaoSalvaId: uuid("refeicao_salva_id").notNull(),
    userId: uuid("user_id").notNull(),
    alimentoBaseId: uuid("alimento_base_id").references(() => alimentosBase.id, { onDelete: "cascade" }),
    alimentoUsuarioId: uuid("alimento_usuario_id"),
    gramas: numeric("gramas", n72).notNull(),
    medidaTexto: text("medida_texto"),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [
    foreignKey({
      columns: [t.refeicaoSalvaId, t.userId],
      foreignColumns: [refeicoesSalvas.id, refeicoesSalvas.userId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.alimentoUsuarioId, t.userId],
      foreignColumns: [alimentosUsuario.id, alimentosUsuario.userId],
    }).onDelete("cascade"),
    index("refeicoes_salvas_itens_refeicao").on(t.refeicaoSalvaId),
    check("refeicoes_salvas_itens_gramas_check", sql`${t.gramas} > 0 and ${t.gramas} <= 5000`),
    check("refeicoes_salvas_itens_medida_check", sql`char_length(${t.medidaTexto}) <= 60`),
    check("refeicoes_salvas_itens_ordem_check", sql`${t.ordem} between 0 and 100`),
    check(
      "refeicoes_salvas_itens_alimento_check",
      sql`num_nonnulls(${t.alimentoBaseId}, ${t.alimentoUsuarioId}) = 1`,
    ),
  ],
);

export type AlimentoBase = typeof alimentosBase.$inferSelect;
export type AlimentoUsuario = typeof alimentosUsuario.$inferSelect;
export type Medida = typeof medidas.$inferSelect;
export type RegistroAlimentar = typeof registrosAlimentares.$inferSelect;
export type RefeicaoSalva = typeof refeicoesSalvas.$inferSelect;
export type MedidaIbge = typeof medidasIbge.$inferSelect;
