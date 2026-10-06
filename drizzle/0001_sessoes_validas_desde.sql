ALTER TABLE "acessos" ADD COLUMN "sessoes_validas_desde" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "acessos_email" ON "acessos" USING btree ("email");