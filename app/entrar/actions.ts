"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/limites";
import { registrarErro } from "@/lib/log";
import { errosPorCampo, formParaObjeto, type ErrosCampos } from "@/lib/validacao/comum";
import {
  cadastroSchema,
  entrarSchema,
  reenviarSchema,
  verificarSchema,
} from "@/lib/validacao/auth";

// Estas Server Actions são públicas (antes do login). Cada uma valida a
// entrada com Zod, aplica limite de tentativas e devolve mensagens genéricas.

export type EstadoAuth = {
  erro?: string;
  erros?: ErrosCampos;
  ok?: string;
  naoVerificado?: boolean;
  valores?: Record<string, string | null>;
};

const MUITAS_TENTATIVAS = "Muitas tentativas. Espere alguns minutos e tente de novo.";
const FALHA_GERAL = "Não foi possível concluir agora. Tente de novo.";

export async function entrar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const bruto = formParaObjeto(form, ["email", "senha"]);
  const valores = { email: bruto.email };
  const r = entrarSchema.safeParse(bruto);
  if (!r.success) return { erros: errosPorCampo(r.error), valores };

  const ip = await ipDaRequisicao();
  if (
    !(await dentroDoLimite([
      { tipo: "entrarPorIp", valor: ip },
      { tipo: "entrarPorEmail", valor: r.data.email },
    ]))
  ) {
    return { erro: MUITAS_TENTATIVAS, valores };
  }

  try {
    const { error } = await auth.signIn.email({ email: r.data.email, password: r.data.senha });
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        return { erro: "Confirme seu e-mail antes de entrar.", naoVerificado: true, valores };
      }
      return { erro: "E-mail ou senha incorretos.", valores };
    }
  } catch (e) {
    registrarErro("entrar", e);
    return { erro: FALHA_GERAL, valores };
  }
  redirect("/hoje");
}

export async function cadastrar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const bruto = formParaObjeto(form, ["nome", "email", "senha"]);
  const valores = { nome: bruto.nome, email: bruto.email };
  const r = cadastroSchema.safeParse(bruto);
  if (!r.success) return { erros: errosPorCampo(r.error), valores };

  if (!(await dentroDoLimite([{ tipo: "cadastroPorIp", valor: await ipDaRequisicao() }]))) {
    return { erro: MUITAS_TENTATIVAS, valores };
  }

  try {
    const { error } = await auth.signUp.email({
      name: r.data.nome,
      email: r.data.email,
      password: r.data.senha,
    });
    if (error) {
      // Mensagem genérica: não revela se o e-mail já tem conta.
      return { erro: "Não foi possível criar a conta com esses dados.", valores };
    }
  } catch (e) {
    registrarErro("cadastrar", e);
    return { erro: FALHA_GERAL, valores };
  }
  redirect("/entrar/verificar");
}

export async function verificar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const bruto = formParaObjeto(form, ["email", "codigo"]);
  const valores = { email: bruto.email };
  const r = verificarSchema.safeParse(bruto);
  if (!r.success) return { erros: errosPorCampo(r.error), valores };

  if (
    !(await dentroDoLimite([
      { tipo: "entrarPorIp", valor: await ipDaRequisicao() },
      { tipo: "verificarPorEmail", valor: r.data.email },
    ]))
  ) {
    return { erro: MUITAS_TENTATIVAS, valores };
  }

  try {
    const { error } = await auth.emailOtp.verifyEmail({ email: r.data.email, otp: r.data.codigo });
    if (error) return { erro: "Código inválido ou vencido.", valores };
  } catch (e) {
    registrarErro("verificar", e);
    return { erro: FALHA_GERAL, valores };
  }
  return { ok: "E-mail confirmado. Agora é só entrar.", valores };
}

export async function reenviarCodigo(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const bruto = formParaObjeto(form, ["email"]);
  const valores = { email: bruto.email };
  const r = reenviarSchema.safeParse(bruto);
  if (!r.success) return { erros: errosPorCampo(r.error), valores };

  if (
    !(await dentroDoLimite([
      { tipo: "cadastroPorIp", valor: await ipDaRequisicao() },
      { tipo: "reenviarPorEmail", valor: r.data.email },
    ]))
  ) {
    return { erro: MUITAS_TENTATIVAS, valores };
  }

  try {
    await auth.emailOtp.sendVerificationOtp({ email: r.data.email, type: "email-verification" });
  } catch (e) {
    registrarErro("reenviar", e);
  }
  // Mesma resposta sempre: não revela se o e-mail existe.
  return { ok: "Se houver uma conta com esse e-mail, um novo código foi enviado.", valores };
}
