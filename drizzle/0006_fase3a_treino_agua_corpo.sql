CREATE TABLE "agenda_treino" (
	"user_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"treino_id" uuid NOT NULL,
	CONSTRAINT "agenda_treino_user_id_dia_semana_pk" PRIMARY KEY("user_id","dia_semana"),
	CONSTRAINT "agenda_treino_dia_check" CHECK ("agenda_treino"."dia_semana" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "agua" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"ml" integer NOT NULL,
	"horario" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agua_ml_check" CHECK ("agua"."ml" between 1 and 5000),
	CONSTRAINT "agua_data_check" CHECK ("agua"."data" >= date '2000-01-01')
);
--> statement-breakpoint
CREATE TABLE "aplicacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aplicacoes_dia_key" UNIQUE("user_id","data"),
	CONSTRAINT "aplicacoes_data_check" CHECK ("aplicacoes"."data" >= date '2000-01-01')
);
--> statement-breakpoint
CREATE TABLE "exercicios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"grupo" text,
	"unilateral" boolean DEFAULT false NOT NULL,
	"carga_por_halter" boolean DEFAULT false NOT NULL,
	"medida" text DEFAULT 'repeticoes' NOT NULL,
	"foto_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercicios_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "exercicios_nome_check" CHECK (char_length("exercicios"."nome") between 1 and 80),
	CONSTRAINT "exercicios_grupo_check" CHECK (char_length("exercicios"."grupo") <= 40),
	CONSTRAINT "exercicios_medida_check" CHECK ("exercicios"."medida" in ('repeticoes', 'segundos')),
	CONSTRAINT "exercicios_foto_check" CHECK ("exercicios"."foto_id" ~ '^[A-Za-z0-9_-]{1,120}$')
);
--> statement-breakpoint
CREATE TABLE "pesagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"peso_kg" numeric(5, 1) NOT NULL,
	"massa_magra_kg" numeric(5, 1),
	"cintura_cm" numeric(5, 1),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pesagens_dia_key" UNIQUE("user_id","data"),
	CONSTRAINT "pesagens_data_check" CHECK ("pesagens"."data" >= date '2000-01-01'),
	CONSTRAINT "pesagens_peso_check" CHECK ("pesagens"."peso_kg" between 20 and 400),
	CONSTRAINT "pesagens_massa_magra_check" CHECK ("pesagens"."massa_magra_kg" between 5 and 300 and "pesagens"."massa_magra_kg" <= "pesagens"."peso_kg"),
	CONSTRAINT "pesagens_cintura_check" CHECK ("pesagens"."cintura_cm" between 30 and 300)
);
--> statement-breakpoint
CREATE TABLE "planos_treino" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"inicio" date NOT NULL,
	"series_inicio" integer DEFAULT 2 NOT NULL,
	"series_depois" integer DEFAULT 3 NOT NULL,
	"semanas_inicio" integer DEFAULT 3 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planos_treino_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "planos_treino_nome_check" CHECK (char_length("planos_treino"."nome") between 1 and 80),
	CONSTRAINT "planos_treino_series_check" CHECK ("planos_treino"."series_inicio" between 1 and 20 and "planos_treino"."series_depois" between 1 and 20),
	CONSTRAINT "planos_treino_semanas_check" CHECK ("planos_treino"."semanas_inicio" between 0 and 52)
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sessao_id" uuid NOT NULL,
	"exercicio_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"carga_kg" numeric(6, 2) DEFAULT 0 NOT NULL,
	"repeticoes" integer,
	"segundos" integer,
	"feito" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_chave" UNIQUE("sessao_id","exercicio_id","numero"),
	CONSTRAINT "series_numero_check" CHECK ("series"."numero" between 1 and 30),
	CONSTRAINT "series_carga_check" CHECK ("series"."carga_kg" between 0 and 1000),
	CONSTRAINT "series_reps_check" CHECK ("series"."repeticoes" between 0 and 1000),
	CONSTRAINT "series_segundos_check" CHECK ("series"."segundos" between 0 and 7200)
);
--> statement-breakpoint
CREATE TABLE "sessoes_treino" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"treino_id" uuid,
	"status" text NOT NULL,
	"motivo" text,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessoes_treino_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "sessoes_treino_dia_key" UNIQUE("user_id","data"),
	CONSTRAINT "sessoes_treino_data_check" CHECK ("sessoes_treino"."data" >= date '2000-01-01'),
	CONSTRAINT "sessoes_treino_status_check" CHECK ("sessoes_treino"."status" in ('feito', 'faltou')),
	CONSTRAINT "sessoes_treino_motivo_check" CHECK ("sessoes_treino"."motivo" is null or "sessoes_treino"."motivo" in ('trabalho', 'cansaco', 'dor_lesao', 'doente', 'imprevisto', 'outro')),
	CONSTRAINT "sessoes_treino_motivo_status_check" CHECK ("sessoes_treino"."status" = 'faltou' or "sessoes_treino"."motivo" is null),
	CONSTRAINT "sessoes_treino_obs_check" CHECK (char_length("sessoes_treino"."observacao") <= 500)
);
--> statement-breakpoint
CREATE TABLE "treino_exercicios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"treino_id" uuid NOT NULL,
	"exercicio_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"series" integer,
	"reps_min" integer NOT NULL,
	"reps_max" integer NOT NULL,
	"descanso_s" integer DEFAULT 90 NOT NULL,
	"observacao" text,
	CONSTRAINT "treino_exercicios_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "treino_exercicios_series_check" CHECK ("treino_exercicios"."series" between 1 and 20),
	CONSTRAINT "treino_exercicios_reps_check" CHECK ("treino_exercicios"."reps_min" between 1 and 1000 and "treino_exercicios"."reps_max" between "treino_exercicios"."reps_min" and 1000),
	CONSTRAINT "treino_exercicios_descanso_check" CHECK ("treino_exercicios"."descanso_s" between 0 and 600),
	CONSTRAINT "treino_exercicios_ordem_check" CHECK ("treino_exercicios"."ordem" between 0 and 60),
	CONSTRAINT "treino_exercicios_obs_check" CHECK (char_length("treino_exercicios"."observacao") <= 300)
);
--> statement-breakpoint
CREATE TABLE "treino_substitutos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"treino_exercicio_id" uuid NOT NULL,
	"exercicio_id" uuid NOT NULL,
	CONSTRAINT "treino_substitutos_key" UNIQUE("treino_exercicio_id","exercicio_id")
);
--> statement-breakpoint
CREATE TABLE "treinos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plano_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"nome" text NOT NULL,
	"foco" text,
	CONSTRAINT "treinos_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "treinos_nome_check" CHECK (char_length("treinos"."nome") between 1 and 60),
	CONSTRAINT "treinos_foco_check" CHECK (char_length("treinos"."foco") <= 120),
	CONSTRAINT "treinos_ordem_check" CHECK ("treinos"."ordem" between 0 and 30)
);
--> statement-breakpoint
CREATE TABLE "trocas_treino" (
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"treino_id" uuid,
	CONSTRAINT "trocas_treino_user_id_data_pk" PRIMARY KEY("user_id","data"),
	CONSTRAINT "trocas_treino_data_check" CHECK ("trocas_treino"."data" >= date '2000-01-01')
);
--> statement-breakpoint
ALTER TABLE "perfis" ADD COLUMN "dia_aplicacao" integer;--> statement-breakpoint
ALTER TABLE "agenda_treino" ADD CONSTRAINT "agenda_treino_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_treino" ADD CONSTRAINT "agenda_treino_treino_id_user_id_treinos_id_user_id_fk" FOREIGN KEY ("treino_id","user_id") REFERENCES "public"."treinos"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agua" ADD CONSTRAINT "agua_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aplicacoes" ADD CONSTRAINT "aplicacoes_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercicios" ADD CONSTRAINT "exercicios_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagens" ADD CONSTRAINT "pesagens_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planos_treino" ADD CONSTRAINT "planos_treino_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_sessao_id_user_id_sessoes_treino_id_user_id_fk" FOREIGN KEY ("sessao_id","user_id") REFERENCES "public"."sessoes_treino"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_exercicio_id_user_id_exercicios_id_user_id_fk" FOREIGN KEY ("exercicio_id","user_id") REFERENCES "public"."exercicios"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes_treino" ADD CONSTRAINT "sessoes_treino_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes_treino" ADD CONSTRAINT "sessoes_treino_treino_id_user_id_treinos_id_user_id_fk" FOREIGN KEY ("treino_id","user_id") REFERENCES "public"."treinos"("id","user_id") ON DELETE SET NULL ("treino_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treino_exercicios" ADD CONSTRAINT "treino_exercicios_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treino_exercicios" ADD CONSTRAINT "treino_exercicios_treino_id_user_id_treinos_id_user_id_fk" FOREIGN KEY ("treino_id","user_id") REFERENCES "public"."treinos"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treino_exercicios" ADD CONSTRAINT "treino_exercicios_exercicio_id_user_id_exercicios_id_user_id_fk" FOREIGN KEY ("exercicio_id","user_id") REFERENCES "public"."exercicios"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treino_substitutos" ADD CONSTRAINT "treino_substitutos_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treino_substitutos" ADD CONSTRAINT "treino_substitutos_treino_exercicio_id_user_id_treino_exercicios_id_user_id_fk" FOREIGN KEY ("treino_exercicio_id","user_id") REFERENCES "public"."treino_exercicios"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treino_substitutos" ADD CONSTRAINT "treino_substitutos_exercicio_id_user_id_exercicios_id_user_id_fk" FOREIGN KEY ("exercicio_id","user_id") REFERENCES "public"."exercicios"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinos" ADD CONSTRAINT "treinos_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinos" ADD CONSTRAINT "treinos_plano_id_user_id_planos_treino_id_user_id_fk" FOREIGN KEY ("plano_id","user_id") REFERENCES "public"."planos_treino"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_treino" ADD CONSTRAINT "trocas_treino_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_treino" ADD CONSTRAINT "trocas_treino_treino_id_user_id_treinos_id_user_id_fk" FOREIGN KEY ("treino_id","user_id") REFERENCES "public"."treinos"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agua_user_data" ON "agua" USING btree ("user_id","data");--> statement-breakpoint
CREATE INDEX "exercicios_user" ON "exercicios" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planos_treino_ativo_key" ON "planos_treino" USING btree ("user_id") WHERE "planos_treino"."ativo";--> statement-breakpoint
CREATE INDEX "series_user_exercicio" ON "series" USING btree ("user_id","exercicio_id");--> statement-breakpoint
CREATE INDEX "sessoes_treino_user_data" ON "sessoes_treino" USING btree ("user_id","data");--> statement-breakpoint
CREATE INDEX "treino_exercicios_treino" ON "treino_exercicios" USING btree ("treino_id");--> statement-breakpoint
CREATE INDEX "treinos_plano" ON "treinos" USING btree ("plano_id");--> statement-breakpoint
ALTER TABLE "perfis" ADD CONSTRAINT "perfis_dia_aplicacao_check" CHECK ("perfis"."dia_aplicacao" between 0 and 6);
--> statement-breakpoint
-- (Postgres 15+) Ao apagar um treino, a sessão fica no histórico e só perde o vínculo (treino_id nulo).
