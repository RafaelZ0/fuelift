CREATE TABLE "gasto_estimado" (
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"metodo" text NOT NULL,
	"valor" integer NOT NULL,
	"minimo" integer NOT NULL,
	"maximo" integer NOT NULL,
	"dias_usados" integer,
	CONSTRAINT "gasto_estimado_user_id_data_pk" PRIMARY KEY("user_id","data"),
	CONSTRAINT "gasto_estimado_metodo_check" CHECK ("gasto_estimado"."metodo" in ('adaptativo', 'katch_mcardle', 'mifflin_st_jeor')),
	CONSTRAINT "gasto_estimado_valor_check" CHECK ("gasto_estimado"."valor" between 500 and 8000 and "gasto_estimado"."minimo" between 500 and 8000 and "gasto_estimado"."maximo" between 500 and 8000 and "gasto_estimado"."minimo" <= "gasto_estimado"."maximo"),
	CONSTRAINT "gasto_estimado_dias_check" CHECK ("gasto_estimado"."dias_usados" between 0 and 400)
);
--> statement-breakpoint
CREATE TABLE "passos_dia" (
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"passos" integer NOT NULL,
	"origem" text DEFAULT 'atalhos' NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passos_dia_user_id_data_pk" PRIMARY KEY("user_id","data"),
	CONSTRAINT "passos_dia_passos_check" CHECK ("passos_dia"."passos" between 0 and 200000),
	CONSTRAINT "passos_dia_origem_check" CHECK ("passos_dia"."origem" in ('atalhos', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "projecoes_peso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"peso_inicial_kg" numeric(5, 1) NOT NULL,
	"peso_meta_kg" numeric(5, 1) NOT NULL,
	"consumo_kcal" integer NOT NULL,
	"gasto_kcal" integer NOT NULL,
	"semanas_para_meta" integer,
	"pontos" jsonb NOT NULL,
	CONSTRAINT "projecoes_peso_pesos_check" CHECK ("projecoes_peso"."peso_inicial_kg" between 20 and 400 and "projecoes_peso"."peso_meta_kg" between 20 and 400),
	CONSTRAINT "projecoes_peso_kcal_check" CHECK ("projecoes_peso"."consumo_kcal" between 500 and 10000 and "projecoes_peso"."gasto_kcal" between 500 and 8000),
	CONSTRAINT "projecoes_peso_semanas_check" CHECK ("projecoes_peso"."semanas_para_meta" between 0 and 104)
);
--> statement-breakpoint
CREATE TABLE "tokens_api" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"hash" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso" timestamp with time zone,
	"revogado_em" timestamp with time zone,
	CONSTRAINT "tokens_api_hash_key" UNIQUE("hash"),
	CONSTRAINT "tokens_api_nome_check" CHECK (char_length("tokens_api"."nome") between 1 and 40),
	CONSTRAINT "tokens_api_hash_check" CHECK ("tokens_api"."hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "uso_ia" DROP CONSTRAINT "uso_ia_tipo_check";--> statement-breakpoint
ALTER TABLE "perfis" ADD COLUMN "ritmo_max_pct" numeric(3, 2) DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "gasto_estimado" ADD CONSTRAINT "gasto_estimado_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passos_dia" ADD CONSTRAINT "passos_dia_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projecoes_peso" ADD CONSTRAINT "projecoes_peso_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens_api" ADD CONSTRAINT "tokens_api_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projecoes_peso_user" ON "projecoes_peso" USING btree ("user_id","criada_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tokens_api_user" ON "tokens_api" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "perfis" ADD CONSTRAINT "perfis_ritmo_max_pct_check" CHECK ("perfis"."ritmo_max_pct" between 0.25 and 1.00);--> statement-breakpoint
ALTER TABLE "uso_ia" ADD CONSTRAINT "uso_ia_tipo_check" CHECK ("uso_ia"."tipo" in ('plano', 'importacao', 'rotulo', 'texto', 'estimativa', 'atividade', 'metas'));