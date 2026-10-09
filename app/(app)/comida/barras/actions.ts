"use server";

import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/sessao";
import { cacheValido, destinoDe, normalizarCodigo } from "@/lib/barras";
import { alimentoDoCodigo, copiarProdutoParaUsuario, guardarProdutoEmCache, obterProdutoEmCache } from "@/lib/dal/produtos";
import { dentroDoLimite } from "@/lib/limites";
import { ErroOff, consultarOff } from "@/lib/off";
import { registrarErro } from "@/lib/log";
import { dataDiario, refeicao as refeicaoSchema } from "@/lib/validacao/comida";

// Server Action pública: sessão, código validado (dígito verificador), limite por usuário e consulta feita
// só pelo servidor. O cache compartilhado só recebe dados do Open Food Facts.

export type EstadoBarras = { erro?: string };

function voltaParams(data: unknown, refeicao: unknown): URLSearchParams {
  const p = new URLSearchParams();
  const d = dataDiario.safeParse(data);
  const r = refeicaoSchema.safeParse(refeicao);
  if (d.success) p.set("data", d.data);
  if (r.success) p.set("refeicao", r.data);
  return p;
}

export async function lerCodigoDeBarras(codigoBruto: unknown, data: unknown, refeicao: unknown): Promise<EstadoBarras> {
  const { userId } = await exigirUsuario();
  const codigo = normalizarCodigo(codigoBruto);
  if (!codigo) return { erro: "Esse código não parece válido. Tente ler de novo ou digite os números." };
  if (!(await dentroDoLimite([{ tipo: "barrasPorUsuario", valor: userId }]))) {
    return { erro: "Muitas leituras seguidas. Espere um minuto e tente de novo." };
  }
  const volta = voltaParams(data, refeicao);

  try {
    // Já existe um alimento seu com esse código: vai direto, sem consultar nada.
    const meu = await alimentoDoCodigo(userId, codigo);
    if (meu) redirect(`/comida/alimento/usuario/${meu}${volta.size ? `?${volta}` : ""}`);

    let produto = await obterProdutoEmCache(codigo);
    if (!produto || !cacheValido(produto.status as "encontrado" | "nao_encontrado", produto.consultadoEm)) {
      try {
        await guardarProdutoEmCache(codigo, await consultarOff(codigo));
        produto = await obterProdutoEmCache(codigo);
      } catch (e) {
        if (!(e instanceof ErroOff)) throw e;
        registrarErro("consultarOff", e);
        if (!produto) return { erro: "Não consegui consultar o produto agora. Tente de novo em instantes ou cadastre pelo rótulo." };
        // Cache vencido, mas a consulta falhou: usa o que já havia.
      }
    }
    if (!produto) return { erro: "Não consegui consultar o produto agora. Tente de novo." };

    const destino = destinoDe({
      status: produto.status as "encontrado" | "nao_encontrado",
      kcal: produto.kcal,
      incompleto: produto.incompleto,
      suspeito: produto.suspeito,
    });
    if (destino === "adicionar") {
      const id = await copiarProdutoParaUsuario(userId, produto);
      if (id) redirect(`/comida/alimento/usuario/${id}${volta.size ? `?${volta}` : ""}`);
    }
    volta.set("codigo", codigo);
    volta.set("motivo", destino === "conferir" ? "conferir" : produto.status === "encontrado" ? "sem_calorias" : "nao_encontrado");
    redirect(`/comida/meus-alimentos/novo?${volta}`);
  } catch (e) {
    // redirect() funciona lançando um erro especial: precisa passar adiante.
    if (typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    registrarErro("lerCodigoDeBarras", e);
    return { erro: "Não foi possível ler agora. Tente de novo." };
  }
}
