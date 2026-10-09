"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { criarTokenApi, MAX_TOKENS_ATIVOS, revogarTokenApi } from "@/lib/dal/passos";
import { registrarErro } from "@/lib/log";
import { gerarToken, hashDoToken } from "@/lib/token-api";

// Server Actions são endpoints públicos: sessão, Zod e user_id da sessão. O token em claro só existe na
// resposta desta action (uma vez); no banco fica só o hash.

export type EstadoToken = { erro?: string; token?: string; nome?: string };

const nomeSchema = z.string().trim().min(1, "Dê um nome (ex.: iPhone).").max(40, "Nome muito longo.");

export async function criarTokenPassos(_: EstadoToken, form: FormData): Promise<EstadoToken> {
  const { userId } = await exigirUsuario();
  const nome = nomeSchema.safeParse(form.get("nome"));
  if (!nome.success) return { erro: nome.error.issues[0]?.message ?? "Nome inválido." };
  const token = gerarToken();
  try {
    if (!(await criarTokenApi(userId, nome.data, hashDoToken(token)))) {
      return { erro: `Você já tem ${MAX_TOKENS_ATIVOS} chaves ativas. Revogue uma para criar outra.` };
    }
  } catch (e) {
    registrarErro("criarTokenPassos", e);
    return { erro: "Não foi possível criar agora. Tente de novo." };
  }
  revalidatePath("/ajustes/passos");
  return { token, nome: nome.data };
}

export async function revogarTokenPassos(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = z.uuid().safeParse(form.get("tokenId"));
  if (!id.success) return;
  try {
    await revogarTokenApi(userId, id.data);
  } catch (e) {
    registrarErro("revogarTokenPassos", e);
  }
  revalidatePath("/ajustes/passos");
}
