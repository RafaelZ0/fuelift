CREATE TABLE "receita_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"receita_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"alimento_base_id" uuid,
	"alimento_usuario_id" uuid,
	"nome" text NOT NULL,
	"gramas" numeric(7, 1) NOT NULL,
	"kcal" numeric(8, 2),
	"proteina_g" numeric(7, 2),
	"carbo_g" numeric(7, 2),
	"gordura_g" numeric(7, 2),
	"fibra_g" numeric(7, 2),
	CONSTRAINT "receita_itens_alimento_check" CHECK (num_nonnulls("receita_itens"."alimento_base_id", "receita_itens"."alimento_usuario_id") <= 1),
	CONSTRAINT "receita_itens_nome_check" CHECK (char_length("receita_itens"."nome") between 1 and 160),
	CONSTRAINT "receita_itens_gramas_check" CHECK ("receita_itens"."gramas" between 0.1 and 10000),
	CONSTRAINT "receita_itens_ordem_check" CHECK ("receita_itens"."ordem" between 0 and 60),
	CONSTRAINT "receita_itens_nutrientes_check" CHECK ("receita_itens"."kcal" between 0 and 50000 and "receita_itens"."proteina_g" between 0 and 5000 and "receita_itens"."carbo_g" between 0 and 5000 and "receita_itens"."gordura_g" between 0 and 5000 and "receita_itens"."fibra_g" between 0 and 5000)
);
--> statement-breakpoint
CREATE TABLE "receitas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"porcoes" numeric(5, 1) NOT NULL,
	"peso_final_g" numeric(7, 1) NOT NULL,
	"alimento_usuario_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receitas_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "receitas_nome_check" CHECK (char_length("receitas"."nome") between 1 and 120),
	CONSTRAINT "receitas_porcoes_check" CHECK ("receitas"."porcoes" between 0.5 and 200),
	CONSTRAINT "receitas_peso_check" CHECK ("receitas"."peso_final_g" between 1 and 50000)
);
--> statement-breakpoint
ALTER TABLE "alimentos_usuario" DROP CONSTRAINT "alimentos_usuario_origem_check";--> statement-breakpoint
ALTER TABLE "receita_itens" ADD CONSTRAINT "receita_itens_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receita_itens" ADD CONSTRAINT "receita_itens_alimento_base_id_alimentos_base_id_fk" FOREIGN KEY ("alimento_base_id") REFERENCES "public"."alimentos_base"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receita_itens" ADD CONSTRAINT "receita_itens_receita_id_user_id_receitas_id_user_id_fk" FOREIGN KEY ("receita_id","user_id") REFERENCES "public"."receitas"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receita_itens" ADD CONSTRAINT "receita_itens_alimento_usuario_id_user_id_alimentos_usuario_id_user_id_fk" FOREIGN KEY ("alimento_usuario_id","user_id") REFERENCES "public"."alimentos_usuario"("id","user_id") ON DELETE SET NULL ("alimento_usuario_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receitas" ADD CONSTRAINT "receitas_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receitas" ADD CONSTRAINT "receitas_alimento_usuario_id_user_id_alimentos_usuario_id_user_id_fk" FOREIGN KEY ("alimento_usuario_id","user_id") REFERENCES "public"."alimentos_usuario"("id","user_id") ON DELETE SET NULL ("alimento_usuario_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receita_itens_receita" ON "receita_itens" USING btree ("receita_id");--> statement-breakpoint
CREATE INDEX "receitas_user" ON "receitas" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "alimentos_usuario" ADD CONSTRAINT "alimentos_usuario_origem_check" CHECK ("alimentos_usuario"."origem" in ('rotulo', 'ia_estimativa', 'codigo_barras', 'receita'));