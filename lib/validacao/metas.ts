import { z } from "zod";
import { dataOpcional, decimalOpcional, inteiroOpcional, textoOpcional } from "./comum";

export const CAMPOS_META = [
  "kcal",
  "proteinaG",
  "carboG",
  "gorduraG",
  "aguaMl",
  "pesoMetaKg",
  "dataMeta",
  "observacao",
] as const;

// Mesmos limites dos CHECKs da tabela metas.
export const metaSchema = z
  .object({
    kcal: inteiroOpcional(500, 10000, "Calorias"),
    proteinaG: inteiroOpcional(0, 500, "Proteína"),
    carboG: inteiroOpcional(0, 1500, "Carboidrato"),
    gorduraG: inteiroOpcional(0, 500, "Gordura"),
    aguaMl: inteiroOpcional(0, 10000, "Água"),
    pesoMetaKg: decimalOpcional(20, 400, "Peso-meta"),
    dataMeta: dataOpcional("Data da meta", { min: "2000-01-01" }),
    observacao: textoOpcional(500, "Observação"),
  })
  .refine(
    (m) => Object.values(m).some((v) => v !== null),
    { message: "Preencha pelo menos uma meta.", path: ["_"] },
  );

export type DadosMeta = z.infer<typeof metaSchema>;
