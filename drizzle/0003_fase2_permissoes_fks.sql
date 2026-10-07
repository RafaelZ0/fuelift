-- Registros apontam para o alimento do usuário por (id, user_id): o banco garante o mesmo dono.
-- Ao apagar o alimento, só alimento_usuario_id vira null (o user_id do registro fica). Recurso do Postgres 15+.
ALTER TABLE "registros_alimentares" ADD CONSTRAINT "registros_alimento_usuario_dono_fk" FOREIGN KEY ("alimento_usuario_id", "user_id") REFERENCES "public"."alimentos_usuario"("id", "user_id") ON DELETE SET NULL ("alimento_usuario_id") ON UPDATE NO ACTION;
--> statement-breakpoint
-- Tabelas oficiais: o papel do app só lê. O ALTER DEFAULT PRIVILEGES da Fase 1 dá escrita
-- automaticamente a tabelas novas, então a escrita é revogada aqui.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "alimentos_base", "fontes_alimentos" FROM fuelift_app;
