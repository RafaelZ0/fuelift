import { z } from "zod";
import { BUSCA_MAX, BUSCA_MIN } from "@/lib/busca";
import { hojeSaoPaulo } from "@/lib/datas";
import { decimalOpcional, textoOpcional } from "./comum";

export const REFEICOES = ["cafe", "almoco", "lanche", "jantar", "ceia"] as const;
export type Refeicao = (typeof REFEICOES)[number];

export const ROTULOS_REFEICAO: Record<Refeicao, string> = {
  cafe: "Café da manhã",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
  ceia: "Ceia",
};

/** Artigo de cada refeição ("o almoço", "a ceia"), para frases como "Adicionar ao/à". */
const FEMININAS: ReadonlySet<Refeicao> = new Set(["ceia"]);

export function comArtigo(r: Refeicao, preposicao: "a" | "em" | "para"): string {
  const nome = ROTULOS_REFEICAO[r].toLowerCase();
  const fem = FEMININAS.has(r);
  if (preposicao === "a") return `${fem ? "à" : "ao"} ${nome}`;
  if (preposicao === "em") return `${fem ? "na" : "no"} ${nome}`;
  return `para ${fem ? "a" : "o"} ${nome}`;
}

export const TIPOS_ALIMENTO = ["base", "usuario"] as const;
export type TipoAlimento = (typeof TIPOS_ALIMENTO)[number];

/** Data do diário: de 2000-01-01 até hoje (fuso de São Paulo). Dias futuros são bloqueados. */
export const dataDiario = z.iso
  .date({ error: "Data inválida." })
  .refine((d) => d >= "2000-01-01", "Data muito antiga.")
  .refine((d) => d <= hojeSaoPaulo(), "Não dá para registrar em dias futuros.");

export const refeicao = z.enum(REFEICOES, { error: "Refeição inválida." });
export const tipoAlimento = z.enum(TIPOS_ALIMENTO, { error: "Alimento inválido." });
export const id = z.uuid({ error: "Identificador inválido." });

export const buscaSchema = z
  .string()
  .trim()
  .min(BUSCA_MIN, `Digite pelo menos ${BUSCA_MIN} letras.`)
  .max(BUSCA_MAX, `Use no máximo ${BUSCA_MAX} caracteres.`);

// Número decimal do formulário (vírgula ou ponto), até 2 casas.
const decimal = (min: number, max: number, rotulo: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,5}([.,]\d{1,2})?$/, `${rotulo}: use um número.`)
    .transform((s) => Number(s.replace(",", ".")))
    .pipe(z.number().min(min, `${rotulo}: mínimo ${min}.`).max(max, `${rotulo}: máximo ${max}.`));

/** Quantidade: em gramas, ou N × medida caseira. O servidor converte para gramas. */
export const quantidadeSchema = z.discriminatedUnion("modo", [
  z.object({ modo: z.literal("gramas"), gramas: decimal(0.1, 5000, "Gramas") }),
  z.object({ modo: z.literal("medida"), medidaId: id, quantidade: decimal(0.1, 50, "Quantidade") }),
]);

export const adicionarSchema = z.object({
  data: dataDiario,
  refeicao,
  tipo: tipoAlimento,
  alimentoId: id,
  quantidade: quantidadeSchema,
});

export const editarRegistroSchema = z.object({
  registroId: id,
  refeicao,
  gramas: decimal(0.1, 5000, "Gramas"),
});

export const medidaSchema = z.object({
  tipo: tipoAlimento,
  alimentoId: id,
  nome: z.string().trim().min(1, "Dê um nome à medida.").max(40, "Nome muito longo."),
  gramas: decimal(0.1, 2000, "Gramas da medida"),
});

// Alimento do rótulo: valores da porção do rótulo (qualquer gramagem), convertidos para 100 g no servidor.
export const CAMPOS_ALIMENTO = [
  "nome",
  "marca",
  "porcaoG",
  "kcal",
  "proteinaG",
  "carboG",
  "gorduraG",
  "fibraG",
  "sodioMg",
] as const;

export const alimentoUsuarioSchema = z.object({
  nome: z.string().trim().min(1, "Digite o nome.").max(120, "Nome muito longo."),
  marca: textoOpcional(80, "Marca"),
  porcaoG: decimal(1, 2000, "Porção do rótulo"),
  kcal: decimal(0, 9000, "Calorias"),
  proteinaG: decimalOpcional(0, 999, "Proteína"),
  carboG: decimalOpcional(0, 999, "Carboidrato"),
  gorduraG: decimalOpcional(0, 999, "Gordura"),
  fibraG: decimalOpcional(0, 999, "Fibra"),
  sodioMg: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    decimal(0, 99999, "Sódio").nullable(),
  ),
});

export const nomeRefeicaoSalvaSchema = z.string().trim().min(1, "Dê um nome.").max(80, "Nome muito longo.");

export const copiarSchema = z.object({
  deData: dataDiario,
  deRefeicao: refeicao,
  paraData: dataDiario,
  paraRefeicao: refeicao,
});
