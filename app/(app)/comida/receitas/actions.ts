"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { obterAlimento } from "@/lib/dal/alimentos";
import { excluirReceita, gravarReceita, obterReceita, type ItemParaGravar } from "@/lib/dal/receitas";
import { registrarErro } from "@/lib/log";
import { calcularNutrientes } from "@/lib/nutricao";
import { calcularReceita, LIMITES_RECEITA } from "@/lib/receita";
import { id as idSchema, tipoAlimento } from "@/lib/validacao/comida";

// Server Actions são endpoints públicos: sessão, Zod e user_id da sessão. Os nutrientes de cada ingrediente
// são SEMPRE calculados aqui a partir do banco (TACO ou alimentos do próprio usuário); o navegador só diz
// qual alimento e quantas gramas.

export type EstadoReceita = { erro?: string };

const entradaSchema = z.object({
  nome: z.string().trim().min(1, "Dê um nome à receita.").max(120, "Nome muito longo."),
  porcoes: z.number({ error: "Informe as porções." }).min(LIMITES_RECEITA.porcoesMin, "Mínimo de 0,5 porção.").max(LIMITES_RECEITA.porcoesMax, "Máximo de 200 porções."),
  pesoFinalG: z.number().min(1).max(LIMITES_RECEITA.pesoFinalMax).nullable(),
  itens: z
    .array(z.object({ tipo: tipoAlimento, alimentoId: idSchema, gramas: z.number().min(0.1, "Quantidade mínima de 0,1 g.").max(10000, "Máximo de 10 kg por ingrediente.") }))
    .min(1, "Adicione pelo menos um ingrediente.")
    .max(LIMITES_RECEITA.itens, `Use no máximo ${LIMITES_RECEITA.itens} ingredientes.`),
});

const FALHA = "Não foi possível salvar agora. Tente de novo.";

export async function salvarReceita(_: EstadoReceita, form: FormData): Promise<EstadoReceita> {
  const { userId } = await exigirUsuario();

  let bruto: unknown;
  try {
    const t = form.get("receita");
    bruto = typeof t === "string" && t.length < 30_000 ? JSON.parse(t) : null;
  } catch {
    bruto = null;
  }
  const r = entradaSchema.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "Dados inválidos." };
  const entrada = r.data;

  const alvo = form.get("receitaId");
  const receitaId = typeof alvo === "string" && alvo !== "" ? idSchema.safeParse(alvo) : null;
  if (receitaId && !receitaId.success) return { erro: "Receita inválida." };

  try {
    let alimentoDaPropriaReceita: string | null = null;
    if (receitaId?.success) {
      const existente = await obterReceita(userId, receitaId.data);
      if (!existente) return { erro: "Receita não encontrada." };
      alimentoDaPropriaReceita = existente.receita.alimentoUsuarioId;
    }

    const itens: ItemParaGravar[] = [];
    for (const it of entrada.itens) {
      if (alimentoDaPropriaReceita && it.tipo === "usuario" && it.alimentoId === alimentoDaPropriaReceita) {
        return { erro: "Uma receita não pode ser ingrediente dela mesma." };
      }
      // Alimento da TACO ou do próprio usuário; de outro usuário = não encontrado.
      const alimento = await obterAlimento(userId, it.tipo, it.alimentoId);
      if (!alimento) return { erro: "Um dos ingredientes não foi encontrado. Troque-o e tente de novo." };
      const n = calcularNutrientes(alimento, it.gramas);
      if (!n) return { erro: `"${alimento.nome}" está sem calorias na tabela. Troque o ingrediente.` };
      itens.push({ tipo: it.tipo, alimentoId: it.alimentoId, nome: alimento.nome, gramas: it.gramas, nutrientes: n });
    }

    const calc = calcularReceita({
      ingredientes: itens.map((i) => ({ nome: i.nome, gramas: i.gramas, nutrientes: i.nutrientes })),
      porcoes: entrada.porcoes,
      pesoFinalG: entrada.pesoFinalG,
    });
    if (!calc.ok) return { erro: calc.erro };

    const id = await gravarReceita(
      userId,
      { nome: entrada.nome, porcoes: calc.porcoes, pesoFinalG: calc.pesoFinalG, itens, por100g: calc.por100g, gramasPorcao: calc.porPorcao.gramas },
      receitaId?.success ? receitaId.data : null,
    );
    revalidatePath("/comida", "layout");
    redirect(`/comida/receitas/${id}?salva=1`);
  } catch (e) {
    if (typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    registrarErro("salvarReceita", e);
    return { erro: FALHA };
  }
}

export async function excluirReceitaAcao(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse(form.get("receitaId"));
  if (!id.success) return;
  try {
    await excluirReceita(userId, id.data);
  } catch (e) {
    registrarErro("excluirReceita", e);
    return;
  }
  revalidatePath("/comida", "layout");
  redirect("/comida/receitas");
}
