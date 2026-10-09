CREATE TABLE "produtos_barras" (
	"codigo" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"nome" text,
	"marca" text,
	"quantidade" text,
	"porcao_g" numeric(6, 2),
	"kcal" numeric(7, 2),
	"proteina_g" numeric(6, 2),
	"carbo_g" numeric(6, 2),
	"gordura_g" numeric(6, 2),
	"fibra_g" numeric(6, 2),
	"sodio_mg" numeric(8, 2),
	"incompleto" boolean DEFAULT false NOT NULL,
	"suspeito" boolean DEFAULT false NOT NULL,
	"consultado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produtos_barras_codigo_check" CHECK ("produtos_barras"."codigo" ~ '^[0-9]{8}$|^[0-9]{13}$'),
	CONSTRAINT "produtos_barras_status_check" CHECK ("produtos_barras"."status" in ('encontrado', 'nao_encontrado')),
	CONSTRAINT "produtos_barras_nome_check" CHECK (char_length("produtos_barras"."nome") between 1 and 120),
	CONSTRAINT "produtos_barras_marca_check" CHECK (char_length("produtos_barras"."marca") <= 80),
	CONSTRAINT "produtos_barras_quantidade_check" CHECK (char_length("produtos_barras"."quantidade") <= 40),
	CONSTRAINT "produtos_barras_kcal_check" CHECK ("produtos_barras"."kcal" between 0 and 900),
	CONSTRAINT "produtos_barras_macros_check" CHECK ("produtos_barras"."proteina_g" between 0 and 100 and "produtos_barras"."carbo_g" between 0 and 100 and "produtos_barras"."gordura_g" between 0 and 100 and "produtos_barras"."fibra_g" between 0 and 100),
	CONSTRAINT "produtos_barras_sodio_check" CHECK ("produtos_barras"."sodio_mg" between 0 and 40000),
	CONSTRAINT "produtos_barras_porcao_check" CHECK ("produtos_barras"."porcao_g" > 0 and "produtos_barras"."porcao_g" <= 2000),
	CONSTRAINT "produtos_barras_encontrado_check" CHECK ("produtos_barras"."status" = 'nao_encontrado' or "produtos_barras"."nome" is not null)
);
--> statement-breakpoint
ALTER TABLE "alimentos_usuario" DROP CONSTRAINT "alimentos_usuario_origem_check";--> statement-breakpoint
ALTER TABLE "uso_ia" DROP CONSTRAINT "uso_ia_tipo_check";--> statement-breakpoint
ALTER TABLE "alimentos_usuario" ADD COLUMN "codigo_barras" text;--> statement-breakpoint
CREATE UNIQUE INDEX "alimentos_usuario_codigo_key" ON "alimentos_usuario" USING btree ("user_id","codigo_barras") WHERE "alimentos_usuario"."codigo_barras" is not null;--> statement-breakpoint
ALTER TABLE "alimentos_usuario" ADD CONSTRAINT "alimentos_usuario_codigo_check" CHECK ("alimentos_usuario"."codigo_barras" ~ '^[0-9]{8}$|^[0-9]{13}$');--> statement-breakpoint
ALTER TABLE "alimentos_usuario" ADD CONSTRAINT "alimentos_usuario_origem_check" CHECK ("alimentos_usuario"."origem" in ('rotulo', 'ia_estimativa', 'codigo_barras'));--> statement-breakpoint
ALTER TABLE "uso_ia" ADD CONSTRAINT "uso_ia_tipo_check" CHECK ("uso_ia"."tipo" in ('plano', 'importacao', 'rotulo'));--> statement-breakpoint
-- Cache compartilhado: o app lê, insere e atualiza (renovação), mas nunca apaga nem esvazia.
REVOKE DELETE, TRUNCATE ON "produtos_barras" FROM fuelift_app;
