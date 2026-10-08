CREATE TABLE "medidas_ibge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo_pof" text NOT NULL,
	"descricao_pof" text NOT NULL,
	"ref_alimento" text NOT NULL,
	"medida" text NOT NULL,
	"gramas" numeric(7, 2) NOT NULL,
	"nome_busca" text NOT NULL,
	CONSTRAINT "medidas_ibge_chave" UNIQUE("ref_alimento","medida","gramas"),
	CONSTRAINT "medidas_ibge_gramas_check" CHECK ("medidas_ibge"."gramas" > 0 and "medidas_ibge"."gramas" <= 2000),
	CONSTRAINT "medidas_ibge_textos_check" CHECK (char_length("medidas_ibge"."ref_alimento") between 1 and 200 and char_length("medidas_ibge"."medida") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "fontes_alimentos" DROP CONSTRAINT "fontes_alimentos_fonte_check";--> statement-breakpoint
ALTER TABLE "medidas" ADD COLUMN "origem" text DEFAULT 'usuario' NOT NULL;--> statement-breakpoint
CREATE INDEX "medidas_ibge_nome_busca_trgm" ON "medidas_ibge" USING gin ("nome_busca" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "fontes_alimentos" ADD CONSTRAINT "fontes_alimentos_fonte_check" CHECK ("fontes_alimentos"."fonte" in ('taco', 'usda', 'ibge'));--> statement-breakpoint
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_origem_check" CHECK ("medidas"."origem" in ('usuario', 'ibge'));