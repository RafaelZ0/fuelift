import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { registrarAcesso, sessoesValidasDesde, type Administrador } from "@/lib/dal/acessos";
import { garantirPerfil } from "@/lib/dal/perfil";
import { sessaoAindaValida } from "@/lib/regras-sessao";
import { auth } from "./server";

export type UsuarioSessao = { id: string; email: string; emailVerificado: boolean };

/**
 * Lê a sessão no servidor (uma vez por requisição). Sessões criadas antes da
 * última troca de senha são tratadas como inexistentes.
 */
export const obterSessao = cache(async (): Promise<UsuarioSessao | null> => {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user?.id || !data?.session) return null;
  if (!sessaoAindaValida(data.session.createdAt, await sessoesValidasDesde(user.id))) return null;
  return { id: user.id, email: user.email, emailVerificado: user.emailVerified === true };
});

function ehAdmin(usuario: UsuarioSessao): boolean {
  if (!usuario.emailVerificado) return false;
  const lista = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(usuario.email.toLowerCase());
}

/** Exige login, sem exigir aprovação (usado só na tela "aguardando"). */
export async function exigirLogin(): Promise<UsuarioSessao> {
  const usuario = await obterSessao();
  if (!usuario) redirect("/entrar");
  return usuario;
}

export type Contexto = { userId: string; admin: Administrador | null };

/**
 * Ponto único de autorização das páginas e Server Actions do app:
 * sessão válida + acesso aprovado. Cria o perfil no primeiro acesso.
 * O user_id vem sempre daqui, nunca do cliente.
 */
export const exigirUsuario = cache(async (): Promise<Contexto> => {
  const usuario = await exigirLogin();
  const admin = ehAdmin(usuario);
  const acesso = await registrarAcesso(usuario.id, usuario.email, admin);
  if (acesso.status !== "aprovado") redirect("/aguardando");

  await garantirPerfil(usuario.id);
  return {
    userId: usuario.id,
    admin: admin ? { userId: usuario.id, __admin: true } : null,
  };
});

export async function exigirAdmin(): Promise<Administrador> {
  const { admin } = await exigirUsuario();
  if (!admin) redirect("/ajustes");
  return admin;
}
