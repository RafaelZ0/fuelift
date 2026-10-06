CREATE TABLE "acessos" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"decidido_em" timestamp with time zone,
	CONSTRAINT "acessos_email_check" CHECK (char_length("acessos"."email") <= 320),
	CONSTRAINT "acessos_status_check" CHECK ("acessos"."status" in ('pendente', 'aprovado', 'recusado'))
);
--> statement-breakpoint
CREATE TABLE "limites" (
	"chave" text NOT NULL,
	"janela" timestamp with time zone NOT NULL,
	"contagem" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "limites_chave_janela_pk" PRIMARY KEY("chave","janela")
);
--> statement-breakpoint
CREATE TABLE "metas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vigente_desde" date NOT NULL,
	"kcal" integer,
	"proteina_g" integer,
	"carbo_g" integer,
	"gordura_g" integer,
	"agua_ml" integer,
	"peso_meta_kg" numeric(5, 1),
	"data_meta" date,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metas_user_id_vigente_desde_key" UNIQUE("user_id","vigente_desde"),
	CONSTRAINT "metas_kcal_check" CHECK ("metas"."kcal" between 500 and 10000),
	CONSTRAINT "metas_proteina_g_check" CHECK ("metas"."proteina_g" between 0 and 500),
	CONSTRAINT "metas_carbo_g_check" CHECK ("metas"."carbo_g" between 0 and 1500),
	CONSTRAINT "metas_gordura_g_check" CHECK ("metas"."gordura_g" between 0 and 500),
	CONSTRAINT "metas_agua_ml_check" CHECK ("metas"."agua_ml" between 0 and 10000),
	CONSTRAINT "metas_peso_meta_kg_check" CHECK ("metas"."peso_meta_kg" between 20 and 400),
	CONSTRAINT "metas_observacao_check" CHECK (char_length("metas"."observacao") <= 500)
);
--> statement-breakpoint
CREATE TABLE "perfis" (
	"user_id" text PRIMARY KEY NOT NULL,
	"nome" text,
	"data_nascimento" date,
	"sexo" text,
	"altura_cm" numeric(4, 1),
	"nivel_atividade" text,
	"inicio_plano" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perfis_nome_check" CHECK (char_length("perfis"."nome") <= 80),
	CONSTRAINT "perfis_data_nascimento_check" CHECK ("perfis"."data_nascimento" >= date '1900-01-01'),
	CONSTRAINT "perfis_sexo_check" CHECK ("perfis"."sexo" in ('masculino', 'feminino')),
	CONSTRAINT "perfis_altura_cm_check" CHECK ("perfis"."altura_cm" between 100 and 250),
	CONSTRAINT "perfis_nivel_atividade_check" CHECK ("perfis"."nivel_atividade" in ('sedentario', 'leve', 'moderado', 'alto', 'muito_alto'))
);
--> statement-breakpoint
ALTER TABLE "metas" ADD CONSTRAINT "metas_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acessos_status" ON "acessos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "limites_janela" ON "limites" USING btree ("janela");--> statement-breakpoint
CREATE INDEX "metas_user_vigencia" ON "metas" USING btree ("user_id","vigente_desde" DESC NULLS LAST);