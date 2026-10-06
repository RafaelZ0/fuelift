import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// user_id = id do usuário no Neon Auth (texto). Sem FK para neon_auth,
// porque o papel do app não tem acesso àquele schema.

export const perfis = pgTable(
  "perfis",
  {
    userId: text("user_id").primaryKey(),
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
    userId: text("user_id")
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
    userId: text("user_id").primaryKey(),
    email: text("email").notNull(),
    status: text("status").notNull().default("pendente"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    decididoEm: timestamp("decidido_em", { withTimezone: true }),
  },
  (t) => [
    check("acessos_email_check", sql`char_length(${t.email}) <= 320`),
    check("acessos_status_check", sql`${t.status} in ('pendente', 'aprovado', 'recusado')`),
    index("acessos_status").on(t.status),
  ],
);

// Contador de tentativas por janela de tempo (seção 5 do SEGURANCA.md).
// A chave é sempre um hash: nunca guarda e-mail ou IP em texto.
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
