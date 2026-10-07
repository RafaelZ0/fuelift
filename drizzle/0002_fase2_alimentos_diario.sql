CREATE TABLE "alimentos_base" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fonte" text NOT NULL,
	"edicao" text NOT NULL,
	"codigo_fonte" text NOT NULL,
	"nome" text NOT NULL,
	"nome_busca" text NOT NULL,
	"grupo" text,
	"kcal" numeric(7, 2),
	"proteina_g" numeric(6, 2),
	"carbo_g" numeric(6, 2),
	"gordura_g" numeric(6, 2),
	"fibra_g" numeric(6, 2),
	"sodio_mg" numeric(8, 2),
	"marcacoes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alimentos_base_fonte_codigo_key" UNIQUE("fonte","codigo_fonte"),
	CONSTRAINT "alimentos_base_fonte_check" CHECK ("alimentos_base"."fonte" in ('taco')),
	CONSTRAINT "alimentos_base_nome_check" CHECK (char_length("alimentos_base"."nome") between 1 and 200),
	CONSTRAINT "alimentos_base_kcal_check" CHECK ("alimentos_base"."kcal" between 0 and 900),
	CONSTRAINT "alimentos_base_proteina_check" CHECK ("alimentos_base"."proteina_g" between 0 and 100),
	CONSTRAINT "alimentos_base_carbo_check" CHECK ("alimentos_base"."carbo_g" between 0 and 100),
	CONSTRAINT "alimentos_base_gordura_check" CHECK ("alimentos_base"."gordura_g" between 0 and 100),
	CONSTRAINT "alimentos_base_fibra_check" CHECK ("alimentos_base"."fibra_g" between 0 and 100),
	CONSTRAINT "alimentos_base_sodio_check" CHECK ("alimentos_base"."sodio_mg" between 0 and 40000)
);
--> statement-breakpoint
CREATE TABLE "alimentos_usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"nome_busca" text NOT NULL,
	"marca" text,
	"kcal" numeric(7, 2) NOT NULL,
	"proteina_g" numeric(6, 2),
	"carbo_g" numeric(6, 2),
	"gordura_g" numeric(6, 2),
	"fibra_g" numeric(6, 2),
	"sodio_mg" numeric(8, 2),
	"origem" text DEFAULT 'rotulo' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alimentos_usuario_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "alimentos_usuario_nome_check" CHECK (char_length("alimentos_usuario"."nome") between 1 and 120),
	CONSTRAINT "alimentos_usuario_marca_check" CHECK (char_length("alimentos_usuario"."marca") <= 80),
	CONSTRAINT "alimentos_usuario_kcal_check" CHECK ("alimentos_usuario"."kcal" between 0 and 900),
	CONSTRAINT "alimentos_usuario_proteina_check" CHECK ("alimentos_usuario"."proteina_g" between 0 and 100),
	CONSTRAINT "alimentos_usuario_carbo_check" CHECK ("alimentos_usuario"."carbo_g" between 0 and 100),
	CONSTRAINT "alimentos_usuario_gordura_check" CHECK ("alimentos_usuario"."gordura_g" between 0 and 100),
	CONSTRAINT "alimentos_usuario_fibra_check" CHECK ("alimentos_usuario"."fibra_g" between 0 and 100),
	CONSTRAINT "alimentos_usuario_sodio_check" CHECK ("alimentos_usuario"."sodio_mg" between 0 and 40000),
	CONSTRAINT "alimentos_usuario_macros_check" CHECK (coalesce("alimentos_usuario"."proteina_g", 0) + coalesce("alimentos_usuario"."carbo_g", 0) + coalesce("alimentos_usuario"."gordura_g", 0) <= 100.5),
	CONSTRAINT "alimentos_usuario_origem_check" CHECK ("alimentos_usuario"."origem" in ('rotulo', 'ia_estimativa'))
);
--> statement-breakpoint
CREATE TABLE "favoritos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"alimento_base_id" uuid,
	"alimento_usuario_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favoritos_alimento_check" CHECK (num_nonnulls("favoritos"."alimento_base_id", "favoritos"."alimento_usuario_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "fontes_alimentos" (
	"fonte" text NOT NULL,
	"edicao" text NOT NULL,
	"titulo" text NOT NULL,
	"url" text NOT NULL,
	"termos" text NOT NULL,
	"citacao" text NOT NULL,
	"arquivo_sha256" text,
	"importado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fontes_alimentos_fonte_edicao_pk" PRIMARY KEY("fonte","edicao"),
	CONSTRAINT "fontes_alimentos_fonte_check" CHECK ("fontes_alimentos"."fonte" in ('taco', 'usda'))
);
--> statement-breakpoint
CREATE TABLE "medidas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"alimento_base_id" uuid,
	"alimento_usuario_id" uuid,
	"nome" text NOT NULL,
	"gramas" numeric(7, 2) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medidas_nome_check" CHECK (char_length("medidas"."nome") between 1 and 40),
	CONSTRAINT "medidas_gramas_check" CHECK ("medidas"."gramas" > 0 and "medidas"."gramas" <= 2000),
	CONSTRAINT "medidas_alimento_check" CHECK (num_nonnulls("medidas"."alimento_base_id", "medidas"."alimento_usuario_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "refeicoes_salvas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refeicoes_salvas_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "refeicoes_salvas_nome_check" CHECK (char_length("refeicoes_salvas"."nome") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "refeicoes_salvas_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refeicao_salva_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"alimento_base_id" uuid,
	"alimento_usuario_id" uuid,
	"gramas" numeric(7, 2) NOT NULL,
	"medida_texto" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "refeicoes_salvas_itens_gramas_check" CHECK ("refeicoes_salvas_itens"."gramas" > 0 and "refeicoes_salvas_itens"."gramas" <= 5000),
	CONSTRAINT "refeicoes_salvas_itens_medida_check" CHECK (char_length("refeicoes_salvas_itens"."medida_texto") <= 60),
	CONSTRAINT "refeicoes_salvas_itens_ordem_check" CHECK ("refeicoes_salvas_itens"."ordem" between 0 and 100),
	CONSTRAINT "refeicoes_salvas_itens_alimento_check" CHECK (num_nonnulls("refeicoes_salvas_itens"."alimento_base_id", "refeicoes_salvas_itens"."alimento_usuario_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "registros_alimentares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"refeicao" text NOT NULL,
	"alimento_base_id" uuid,
	"alimento_usuario_id" uuid,
	"nome" text NOT NULL,
	"gramas" numeric(7, 2) NOT NULL,
	"medida_texto" text,
	"kcal" numeric(8, 2) NOT NULL,
	"proteina_g" numeric(7, 2),
	"carbo_g" numeric(7, 2),
	"gordura_g" numeric(7, 2),
	"fibra_g" numeric(7, 2),
	"origem" text DEFAULT 'manual' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registros_refeicao_check" CHECK ("registros_alimentares"."refeicao" in ('cafe', 'almoco', 'lanche', 'jantar', 'ceia')),
	CONSTRAINT "registros_data_check" CHECK ("registros_alimentares"."data" >= date '2000-01-01'),
	CONSTRAINT "registros_nome_check" CHECK (char_length("registros_alimentares"."nome") between 1 and 160),
	CONSTRAINT "registros_gramas_check" CHECK ("registros_alimentares"."gramas" > 0 and "registros_alimentares"."gramas" <= 5000),
	CONSTRAINT "registros_medida_check" CHECK (char_length("registros_alimentares"."medida_texto") <= 60),
	CONSTRAINT "registros_kcal_check" CHECK ("registros_alimentares"."kcal" between 0 and 10000),
	CONSTRAINT "registros_proteina_check" CHECK ("registros_alimentares"."proteina_g" between 0 and 5000),
	CONSTRAINT "registros_carbo_check" CHECK ("registros_alimentares"."carbo_g" between 0 and 5000),
	CONSTRAINT "registros_gordura_check" CHECK ("registros_alimentares"."gordura_g" between 0 and 5000),
	CONSTRAINT "registros_fibra_check" CHECK ("registros_alimentares"."fibra_g" between 0 and 5000),
	CONSTRAINT "registros_alimento_check" CHECK (num_nonnulls("registros_alimentares"."alimento_base_id", "registros_alimentares"."alimento_usuario_id") <= 1),
	CONSTRAINT "registros_origem_check" CHECK ("registros_alimentares"."origem" in ('manual', 'ia_texto', 'ia_foto', 'codigo_barras'))
);
--> statement-breakpoint
ALTER TABLE "alimentos_base" ADD CONSTRAINT "alimentos_base_fonte_edicao_fontes_alimentos_fonte_edicao_fk" FOREIGN KEY ("fonte","edicao") REFERENCES "public"."fontes_alimentos"("fonte","edicao") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alimentos_usuario" ADD CONSTRAINT "alimentos_usuario_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_alimento_base_id_alimentos_base_id_fk" FOREIGN KEY ("alimento_base_id") REFERENCES "public"."alimentos_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_alimento_usuario_id_user_id_alimentos_usuario_id_user_id_fk" FOREIGN KEY ("alimento_usuario_id","user_id") REFERENCES "public"."alimentos_usuario"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_alimento_base_id_alimentos_base_id_fk" FOREIGN KEY ("alimento_base_id") REFERENCES "public"."alimentos_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_alimento_usuario_id_user_id_alimentos_usuario_id_user_id_fk" FOREIGN KEY ("alimento_usuario_id","user_id") REFERENCES "public"."alimentos_usuario"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_salvas" ADD CONSTRAINT "refeicoes_salvas_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_salvas_itens" ADD CONSTRAINT "refeicoes_salvas_itens_alimento_base_id_alimentos_base_id_fk" FOREIGN KEY ("alimento_base_id") REFERENCES "public"."alimentos_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_salvas_itens" ADD CONSTRAINT "refeicoes_salvas_itens_refeicao_salva_id_user_id_refeicoes_salvas_id_user_id_fk" FOREIGN KEY ("refeicao_salva_id","user_id") REFERENCES "public"."refeicoes_salvas"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_salvas_itens" ADD CONSTRAINT "refeicoes_salvas_itens_alimento_usuario_id_user_id_alimentos_usuario_id_user_id_fk" FOREIGN KEY ("alimento_usuario_id","user_id") REFERENCES "public"."alimentos_usuario"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_alimentares" ADD CONSTRAINT "registros_alimentares_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_alimentares" ADD CONSTRAINT "registros_alimentares_alimento_base_id_alimentos_base_id_fk" FOREIGN KEY ("alimento_base_id") REFERENCES "public"."alimentos_base"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alimentos_base_nome_busca_trgm" ON "alimentos_base" USING gin ("nome_busca" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "alimentos_usuario_user" ON "alimentos_usuario" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alimentos_usuario_nome_busca_trgm" ON "alimentos_usuario" USING gin ("nome_busca" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "favoritos_base_key" ON "favoritos" USING btree ("user_id","alimento_base_id") WHERE "favoritos"."alimento_base_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "favoritos_usuario_key" ON "favoritos" USING btree ("user_id","alimento_usuario_id") WHERE "favoritos"."alimento_usuario_id" is not null;--> statement-breakpoint
CREATE INDEX "medidas_user" ON "medidas" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "medidas_base_nome_key" ON "medidas" USING btree ("user_id","alimento_base_id",lower("nome")) WHERE "medidas"."alimento_base_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "medidas_usuario_nome_key" ON "medidas" USING btree ("user_id","alimento_usuario_id",lower("nome")) WHERE "medidas"."alimento_usuario_id" is not null;--> statement-breakpoint
CREATE INDEX "refeicoes_salvas_user" ON "refeicoes_salvas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refeicoes_salvas_itens_refeicao" ON "refeicoes_salvas_itens" USING btree ("refeicao_salva_id");--> statement-breakpoint
CREATE INDEX "registros_user_data" ON "registros_alimentares" USING btree ("user_id","data");--> statement-breakpoint
CREATE INDEX "registros_user_criado" ON "registros_alimentares" USING btree ("user_id","criado_em" DESC NULLS LAST);