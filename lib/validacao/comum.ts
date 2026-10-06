import { z } from "zod";

// Campos vazios do formulário viram null; o restante é validado como texto.
const vazioParaNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v;

/** Inteiro opcional dentro de [min, max]. Aceita só dígitos. */
export function inteiroOpcional(min: number, max: number, rotulo: string) {
  return z.preprocess(
    vazioParaNull,
    z
      .string()
      .regex(/^\d{1,6}$/, `${rotulo}: use só números inteiros.`)
      .transform(Number)
      .pipe(
        z
          .number()
          .int()
          .min(min, `${rotulo}: mínimo ${min}.`)
          .max(max, `${rotulo}: máximo ${max}.`),
      )
      .nullable(),
  );
}

/** Decimal opcional com até 1 casa (vírgula ou ponto) dentro de [min, max]. */
export function decimalOpcional(min: number, max: number, rotulo: string) {
  return z.preprocess(
    vazioParaNull,
    z
      .string()
      .regex(/^\d{1,3}([.,]\d)?$/, `${rotulo}: use um número com até 1 casa decimal.`)
      .transform((s) => Number(s.replace(",", ".")))
      .pipe(
        z
          .number()
          .min(min, `${rotulo}: mínimo ${min}.`)
          .max(max, `${rotulo}: máximo ${max}.`),
      )
      .nullable(),
  );
}

/** Data opcional AAAA-MM-DD dentro de [min, max] (comparação de texto ISO). */
export function dataOpcional(rotulo: string, opcoes: { min?: string; max?: () => string } = {}) {
  return z.preprocess(
    vazioParaNull,
    z
      .iso.date({ error: `${rotulo}: data inválida.` })
      .refine((d) => !opcoes.min || d >= opcoes.min, `${rotulo}: data muito antiga.`)
      .refine((d) => !opcoes.max || d <= opcoes.max(), `${rotulo}: data no futuro.`)
      .nullable(),
  );
}

export function textoOpcional(max: number, rotulo: string) {
  return z.preprocess(
    vazioParaNull,
    z.string().max(max, `${rotulo}: máximo ${max} caracteres.`).nullable(),
  );
}

export function opcaoOpcional<const T extends readonly [string, ...string[]]>(
  opcoes: T,
  rotulo: string,
) {
  return z.preprocess(vazioParaNull, z.enum(opcoes, { error: `${rotulo}: opção inválida.` }).nullable());
}

/** Converte FormData em objeto simples, ignorando arquivos. */
export function formParaObjeto(form: FormData, campos: readonly string[]) {
  const obj: Record<string, string | null> = {};
  for (const campo of campos) {
    const v = form.get(campo);
    obj[campo] = typeof v === "string" ? v : null;
  }
  return obj;
}

export type ErrosCampos = Record<string, string>;

export function errosPorCampo(erro: z.ZodError): ErrosCampos {
  const erros: ErrosCampos = {};
  for (const issue of erro.issues) {
    const campo = String(issue.path[0] ?? "_");
    if (!erros[campo]) erros[campo] = issue.message;
  }
  return erros;
}
