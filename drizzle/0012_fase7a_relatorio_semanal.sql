CREATE TABLE "relatorios_semanais" (
	"user_id" uuid NOT NULL,
	"inicio" date NOT NULL,
	"dados" jsonb NOT NULL,
	"texto_ia" text,
	"texto_hash" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relatorios_semanais_user_id_inicio_pk" PRIMARY KEY("user_id","inicio"),
	CONSTRAINT "relatorios_semanais_segunda_check" CHECK (extract(isodow from "relatorios_semanais"."inicio") = 1),
	CONSTRAINT "relatorios_semanais_texto_check" CHECK (char_length("relatorios_semanais"."texto_ia") <= 2000),
	CONSTRAINT "relatorios_semanais_hash_check" CHECK ("relatorios_semanais"."texto_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "uso_ia" DROP CONSTRAINT "uso_ia_tipo_check";--> statement-breakpoint
ALTER TABLE "relatorios_semanais" ADD CONSTRAINT "relatorios_semanais_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uso_ia" ADD CONSTRAINT "uso_ia_tipo_check" CHECK ("uso_ia"."tipo" in ('plano', 'importacao', 'rotulo', 'texto', 'estimativa', 'atividade', 'metas', 'relatorio'));