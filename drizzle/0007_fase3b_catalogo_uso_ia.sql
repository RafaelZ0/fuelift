CREATE TABLE "catalogo_exercicios" (
	"id" text PRIMARY KEY NOT NULL,
	"nome_en" text NOT NULL,
	"nome_busca" text NOT NULL,
	"equipamento" text,
	"categoria" text,
	"nivel" text,
	"musculos_primarios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tem_fotos" boolean DEFAULT true NOT NULL,
	CONSTRAINT "catalogo_exercicios_id_check" CHECK ("catalogo_exercicios"."id" ~ '^[A-Za-z0-9_-]{1,120}$'),
	CONSTRAINT "catalogo_exercicios_nome_check" CHECK (char_length("catalogo_exercicios"."nome_en") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "uso_ia" (
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"tipo" text NOT NULL,
	"chamadas" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "uso_ia_user_id_data_tipo_pk" PRIMARY KEY("user_id","data","tipo"),
	CONSTRAINT "uso_ia_tipo_check" CHECK ("uso_ia"."tipo" in ('plano', 'importacao')),
	CONSTRAINT "uso_ia_chamadas_check" CHECK ("uso_ia"."chamadas" between 0 and 10000)
);
--> statement-breakpoint
ALTER TABLE "perfis" ADD COLUMN "ia_aceite_versao" integer;--> statement-breakpoint
ALTER TABLE "perfis" ADD COLUMN "ia_aceite_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "uso_ia" ADD CONSTRAINT "uso_ia_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalogo_exercicios_nome_busca_trgm" ON "catalogo_exercicios" USING gin ("nome_busca" gin_trgm_ops);