import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email("E-mail inválido."));

export const entrarSchema = z.object({
  email,
  senha: z.string().min(1, "Digite a senha.").max(128, "Senha muito longa."),
});

const senhaNova = z
  .string()
  .min(10, "A senha precisa ter pelo menos 10 caracteres.")
  .max(128, "Senha muito longa.");

const codigo = z.string().trim().regex(/^\d{6}$/, "O código tem 6 números.");

export const cadastroSchema = z.object({
  nome: z.string().trim().min(1, "Digite seu nome.").max(80, "Nome muito longo."),
  email,
  senha: senhaNova,
});

export const verificarSchema = z.object({ email, codigo });

export const reenviarSchema = z.object({ email });

export const recuperarSchema = z.object({ email });

export const novaSenhaSchema = z
  .object({ email, codigo, senha: senhaNova, confirmacao: z.string().max(128) })
  .refine((d) => d.senha === d.confirmacao, {
    message: "As senhas não são iguais.",
    path: ["confirmacao"],
  });
