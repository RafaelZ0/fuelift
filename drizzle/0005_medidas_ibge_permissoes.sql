-- Medidas do IBGE: o papel do app só lê (o ALTER DEFAULT PRIVILEGES da Fase 1 daria escrita).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "medidas_ibge" FROM fuelift_app;
