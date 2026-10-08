-- Catálogo de exercícios (domínio público): o papel do app só lê.
-- (o ALTER DEFAULT PRIVILEGES da Fase 1 daria escrita automaticamente a tabelas novas.)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "catalogo_exercicios" FROM fuelift_app;
