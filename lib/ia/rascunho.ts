// Rascunho de plano de treino gerado pela IA (funções puras, sem rede nem banco).
// A resposta da IA é DADO NÃO CONFIÁVEL: tudo passa por limpeza de texto e por limites antes de
// virar rascunho, e o rascunho só vira plano depois que o usuário confirma.
import { z } from "zod";

export const LIMITES = {
  treinos: 7,
  exerciciosPorTreino: 12,
  alertas: 5,
  textoNome: 80,
  textoFoco: 120,
  textoGrupo: 40,
  textoObs: 300,
  textoAlerta: 220,
} as const;

/** Remove caracteres de controle e quebras de linha; limita o tamanho. */
export function limparTexto(valor: unknown, max: number): string {
  if (typeof valor !== "string") return "";
  let saida = "";
  for (const c of valor) {
    const n = c.codePointAt(0)!;
    // Controles (U+0000–U+001F, U+007F–U+009F) e separadores de linha/parágrafo (U+2028, U+2029) viram espaço.
    const controle = n <= 0x1f || (n >= 0x7f && n <= 0x9f) || n === 0x2028 || n === 0x2029;
    saida += controle ? " " : c;
  }
  return saida.replace(/\s+/g, " ").trim().slice(0, max);
}

const inteiroEntre = (min: number, max: number) =>
  z.preprocess((v) => (typeof v === "string" && /^\d{1,6}$/.test(v.trim()) ? Number(v) : v), z.number().int().min(min).max(max));

const textoOpcional = (max: number) => z.preprocess((v) => (typeof v === "string" ? limparTexto(v, max) : null), z.string().max(max).nullable()).transform((v) => (v ? v : null));

// Exercício como a IA o devolve (campos desconhecidos são ignorados).
const exercicioIaSchema = z.object({
  nome_pt: z.preprocess((v) => limparTexto(v, LIMITES.textoNome), z.string().min(1)),
  nome_en: z.preprocess((v) => limparTexto(v, 120), z.string()).default(""),
  grupo: textoOpcional(LIMITES.textoGrupo).default(null),
  series: inteiroEntre(1, 6).nullable().default(null),
  reps_min: inteiroEntre(1, 100),
  reps_max: inteiroEntre(1, 100),
  descanso_s: inteiroEntre(0, 300).default(90),
  unilateral: z.boolean().default(false),
  carga_por_halter: z.boolean().default(false),
  medida: z.enum(["repeticoes", "segundos"]).default("repeticoes"),
  observacao: textoOpcional(LIMITES.textoObs).default(null),
});

export type ExercicioRascunho = {
  nomePt: string;
  nomeEn: string;
  grupo: string | null;
  series: number | null;
  repsMin: number;
  repsMax: number;
  descansoS: number;
  unilateral: boolean;
  cargaPorHalter: boolean;
  medida: "repeticoes" | "segundos";
  observacao: string | null;
  /** Foto escolhida no catálogo (Free Exercise DB), confirmada pelo usuário. */
  fotoId: string | null;
  fotoNome: string | null;
};

export type TreinoRascunho = {
  nome: string;
  foco: string | null;
  /** 0 = domingo ... 6 = sábado. */
  diaSugerido: number | null;
  exercicios: ExercicioRascunho[];
};

export type Rascunho = {
  nome: string;
  treinos: TreinoRascunho[];
  alertas: string[];
};

export type ResultadoSanitizacao = { rascunho: Rascunho; descartados: number };

function treinoDaIa(bruto: unknown): { treino: TreinoRascunho | null; descartados: number } {
  if (typeof bruto !== "object" || bruto === null) return { treino: null, descartados: 1 };
  const t = bruto as Record<string, unknown>;
  const nome = limparTexto(t.nome, 60);
  const lista = Array.isArray(t.exercicios) ? t.exercicios : [];
  let descartados = 0;
  const exercicios: ExercicioRascunho[] = [];
  for (const item of lista) {
    if (exercicios.length >= LIMITES.exerciciosPorTreino) {
      descartados++;
      continue;
    }
    const r = exercicioIaSchema.safeParse(item);
    if (!r.success || r.data.reps_max < r.data.reps_min) {
      descartados++;
      continue;
    }
    const e = r.data;
    exercicios.push({
      nomePt: e.nome_pt,
      nomeEn: e.nome_en,
      grupo: e.grupo,
      series: e.series,
      repsMin: e.reps_min,
      repsMax: e.reps_max,
      descansoS: e.descanso_s,
      unilateral: e.unilateral,
      cargaPorHalter: e.carga_por_halter,
      medida: e.medida,
      observacao: e.observacao,
      fotoId: null,
      fotoNome: null,
    });
  }
  if (!nome || exercicios.length === 0) return { treino: null, descartados: descartados + 1 };
  const dia = typeof t.dia_sugerido === "number" && Number.isInteger(t.dia_sugerido) && t.dia_sugerido >= 0 && t.dia_sugerido <= 6 ? t.dia_sugerido : null;
  return { treino: { nome, foco: limparTexto(t.foco, LIMITES.textoFoco) || null, diaSugerido: dia, exercicios }, descartados };
}

/**
 * Converte a resposta da IA em rascunho seguro. Itens fora dos limites são descartados (e
 * contados), nunca "corrigidos" em silêncio. Lança erro se não sobrar nenhum treino válido.
 */
export function sanitizarRespostaDaIa(bruto: unknown): ResultadoSanitizacao {
  if (typeof bruto !== "object" || bruto === null) throw new Error("resposta da IA fora do formato");
  const r = bruto as Record<string, unknown>;
  const plano = typeof r.plano === "object" && r.plano !== null ? (r.plano as Record<string, unknown>) : {};
  const treinosBrutos = Array.isArray(r.treinos) ? r.treinos : [];
  let descartados = Math.max(0, treinosBrutos.length - LIMITES.treinos);
  const treinos: TreinoRascunho[] = [];
  for (const b of treinosBrutos.slice(0, LIMITES.treinos)) {
    const { treino, descartados: d } = treinoDaIa(b);
    descartados += d;
    if (treino) treinos.push(treino);
  }
  if (treinos.length === 0) throw new Error("a IA não devolveu nenhum treino válido");
  const alertas = (Array.isArray(r.alertas) ? r.alertas : [])
    .map((a) => limparTexto(a, LIMITES.textoAlerta))
    .filter(Boolean)
    .slice(0, LIMITES.alertas);
  return { rascunho: { nome: limparTexto(plano.nome, LIMITES.textoNome) || "Plano com IA", treinos, alertas }, descartados };
}

// ─── Validação final (antes de salvar): o rascunho volta do navegador e é revalidado do zero ───

const textoLimitado = (max: number, minimo = 1) => z.string().trim().min(minimo).max(max);
const fotoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/).nullable();

export const exercicioRascunhoSchema = z
  .object({
    nomePt: textoLimitado(LIMITES.textoNome),
    nomeEn: z.string().trim().max(120),
    grupo: z.string().trim().max(LIMITES.textoGrupo).nullable(),
    series: z.number().int().min(1).max(20).nullable(),
    repsMin: z.number().int().min(1).max(1000),
    repsMax: z.number().int().min(1).max(1000),
    descansoS: z.number().int().min(0).max(600),
    unilateral: z.boolean(),
    cargaPorHalter: z.boolean(),
    medida: z.enum(["repeticoes", "segundos"]),
    observacao: z.string().trim().max(LIMITES.textoObs).nullable(),
    fotoId: fotoIdSchema,
    fotoNome: z.string().trim().max(120).nullable(),
  })
  .refine((e) => e.repsMax >= e.repsMin, { message: "repetições máximas menores que as mínimas" });

export const rascunhoSchema = z.object({
  nome: textoLimitado(LIMITES.textoNome),
  treinos: z
    .array(
      z.object({
        nome: textoLimitado(60),
        foco: z.string().trim().max(LIMITES.textoFoco).nullable(),
        diaSugerido: z.number().int().min(0).max(6).nullable(),
        exercicios: z.array(exercicioRascunhoSchema).min(1).max(LIMITES.exerciciosPorTreino),
      }),
    )
    .min(1)
    .max(LIMITES.treinos),
  alertas: z.array(z.string().trim().max(LIMITES.textoAlerta)).max(LIMITES.alertas),
});

// ─── Esquema JSON enviado ao Gemini (subconjunto simples de JSON Schema) ───

// Sem maxItems: o Gemini recusa a palavra (400); os limites são aplicados em sanitizarRespostaDaIa.
export const ESQUEMA_RESPOSTA_IA = {
  type: "object",
  properties: {
    plano: {
      type: "object",
      properties: { nome: { type: "string", description: "Nome curto do plano, em português." } },
      required: ["nome"],
    },
    treinos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Ex.: Dia 1 – superiores (empurrar)" },
          foco: { type: "string" },
          dia_sugerido: { type: "integer", minimum: 0, maximum: 6, description: "0 = domingo ... 6 = sábado" },
          exercicios: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nome_pt: { type: "string", description: "Nome do exercício em português do Brasil." },
                nome_en: { type: "string", description: "Nome padrão em inglês, como em catálogos de exercícios." },
                grupo: { type: "string", description: "Grupo muscular principal, em português." },
                series: { type: "integer", minimum: 1, maximum: 6 },
                reps_min: { type: "integer", minimum: 1, maximum: 100 },
                reps_max: { type: "integer", minimum: 1, maximum: 100 },
                descanso_s: { type: "integer", minimum: 0, maximum: 300 },
                unilateral: { type: "boolean" },
                carga_por_halter: { type: "boolean" },
                medida: { type: "string", enum: ["repeticoes", "segundos"] },
                observacao: { type: "string" },
              },
              required: ["nome_pt", "nome_en", "reps_min", "reps_max"],
            },
          },
        },
        required: ["nome", "exercicios"],
      },
    },
  },
  required: ["plano", "treinos"],
} as const;
