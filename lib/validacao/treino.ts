import { z } from "zod";
import { hojeSaoPaulo } from "@/lib/datas";
import { textoOpcional } from "./comum";

// Mesmos limites dos CHECKs do banco (fase 3A).

export const MOTIVOS = ["trabalho", "cansaco", "dor_lesao", "doente", "imprevisto", "outro"] as const;
export const ROTULOS_MOTIVO: Record<(typeof MOTIVOS)[number], string> = {
  trabalho: "Trabalho",
  cansaco: "Cansaço",
  dor_lesao: "Dor ou lesão",
  doente: "Doente",
  imprevisto: "Imprevisto",
  outro: "Outro",
};

const vazioParaNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v);

export const id = z.uuid({ error: "Identificador inválido." });

/** Número com vírgula ou ponto, até `casas` decimais, dentro de [min, max]. */
export function numero(min: number, max: number, rotulo: string, casas = 2) {
  // Sem casas decimais, só dígitos (a parte decimal não existe).
  const re = casas === 0 ? /^\d{1,6}$/ : new RegExp(`^\\d{1,6}([.,]\\d{1,${casas}})?$`);
  return z
    .string()
    .trim()
    .regex(re, `${rotulo}: use um número${casas === 0 ? " inteiro" : ""}.`)
    .transform((s) => Number(s.replace(",", ".")))
    .pipe(z.number().min(min, `${rotulo}: mínimo ${min}.`).max(max, `${rotulo}: máximo ${max}.`));
}

export const numeroOpcional = (min: number, max: number, rotulo: string, casas = 1) =>
  z.preprocess(vazioParaNull, numero(min, max, rotulo, casas).nullable());

export const inteiro = (min: number, max: number, rotulo: string) => numero(min, max, rotulo, 0);

/** Caixa de seleção do formulário: marcada chega como "on" ou "true". */
export const caixa = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const dataAteHoje = z.iso
  .date({ error: "Data inválida." })
  .refine((d) => d >= "2000-01-01", "Data muito antiga.")
  .refine((d) => d <= hojeSaoPaulo(), "Não dá para registrar em dias futuros.");

export const dataQualquer = z.iso.date({ error: "Data inválida." }).refine((d) => d >= "2000-01-01", "Data muito antiga.");

// ─── Plano ───

export const exercicioSchema = z.object({
  nome: z.string().trim().min(1, "Digite o nome.").max(80, "Nome muito longo."),
  grupo: textoOpcional(40, "Grupo muscular"),
  unilateral: caixa,
  cargaPorHalter: caixa,
  medida: z.enum(["repeticoes", "segundos"], { error: "Escolha repetições ou segundos." }),
  fotoId: z.preprocess(vazioParaNull, z.string().regex(/^[A-Za-z0-9_-]{1,120}$/, "Foto inválida.").nullable()),
});

export const planoSchema = z.object({
  nome: z.string().trim().min(1, "Digite o nome do plano.").max(80, "Nome muito longo."),
  inicio: dataQualquer,
  seriesInicio: inteiro(1, 20, "Séries do início"),
  seriesDepois: inteiro(1, 20, "Séries depois"),
  semanasInicio: inteiro(0, 52, "Semanas de readaptação"),
});

export const treinoSchema = z.object({
  nome: z.string().trim().min(1, "Digite o nome do treino.").max(60, "Nome muito longo."),
  foco: textoOpcional(120, "Foco"),
});

export const treinoExercicioSchema = z
  .object({
    treinoId: id,
    exercicioId: id,
    series: z.preprocess(vazioParaNull, inteiro(1, 20, "Séries").nullable()),
    repsMin: inteiro(1, 1000, "Repetições mínimas"),
    repsMax: inteiro(1, 1000, "Repetições máximas"),
    descansoS: inteiro(0, 600, "Descanso"),
    observacao: textoOpcional(300, "Observação"),
  })
  .refine((d) => d.repsMax >= d.repsMin, { message: "O máximo precisa ser maior ou igual ao mínimo.", path: ["repsMax"] });

export const agendaSchema = z.object({
  diaSemana: inteiro(0, 6, "Dia da semana"),
  treinoId: z.preprocess(vazioParaNull, id.nullable()),
});

export const trocaSchema = z.object({
  data: dataQualquer,
  treinoId: z.preprocess((v) => (v === "descanso" ? null : v), id.nullable()),
});

// ─── Sessão ───

export const serieSchema = z
  .object({
    data: dataAteHoje,
    treinoId: z.preprocess(vazioParaNull, id.nullable()),
    exercicioId: id,
    numero: inteiro(1, 30, "Série"),
    cargaKg: numero(0, 1000, "Carga", 2),
    repeticoes: z.preprocess(vazioParaNull, inteiro(0, 1000, "Repetições").nullable()),
    segundos: z.preprocess(vazioParaNull, inteiro(0, 7200, "Segundos").nullable()),
    feito: caixa,
  })
  .refine((d) => d.repeticoes !== null || d.segundos !== null, { message: "Informe repetições ou segundos.", path: ["repeticoes"] });

export const faltaSchema = z.object({
  data: dataAteHoje,
  treinoId: z.preprocess(vazioParaNull, id.nullable()),
  motivo: z.enum(MOTIVOS, { error: "Escolha um motivo." }),
  observacao: textoOpcional(500, "Observação"),
});

export const concluirSchema = z.object({
  data: dataAteHoje,
  treinoId: z.preprocess(vazioParaNull, id.nullable()),
  observacao: textoOpcional(500, "Observação"),
});

// ─── Água e corpo ───

export const aguaSchema = z.object({ data: dataAteHoje, ml: inteiro(1, 5000, "Quantidade") });

export const pesagemSchema = z
  .object({
    data: dataAteHoje,
    pesoKg: numero(20, 400, "Peso", 1),
    massaMagraKg: numeroOpcional(5, 300, "Massa magra", 1),
    cinturaCm: numeroOpcional(30, 300, "Cintura", 1),
  })
  .refine((d) => d.massaMagraKg === null || d.massaMagraKg <= d.pesoKg, {
    message: "A massa magra não pode passar do peso.",
    path: ["massaMagraKg"],
  });

export const aplicacaoSchema = z.object({ data: dataAteHoje });
export const diaAplicacaoSchema = z.preprocess(vazioParaNull, inteiro(0, 6, "Dia da semana").nullable());
