import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { usoDoDia } from "@/lib/dal/ia";
import { hojeSaoPaulo } from "@/lib/datas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { planoGratuito } from "@/lib/ia/config";
import { dataDiario, refeicao as refeicaoSchema, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { Voltar, voltaQuery } from "../comum";
import { FluxoRefeicao } from "./fluxo";

export const metadata = { title: "Registrar com IA · Kalyft" };

export default async function PaginaRefeicaoIa(props: PageProps<"/comida/ia">) {
  const { userId, admin } = await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data ?? hojeSaoPaulo();
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? "almoco";
  const volta = voltaQuery(data, ref);

  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) {
    return (
      <div className="space-y-6">
        <Voltar href={`/comida/adicionar${volta}`} />
        <h1 className="text-3xl font-black">Registrar com IA</h1>
        <p className="text-lg text-suave">{acesso.erro}</p>
        {acesso.precisaAceite ? (
          <Link href="/treino/ia" className="flex min-h-14 items-center justify-center rounded-full bg-destaque text-lg font-bold text-sobre-destaque">
            Ler e aceitar o aviso da IA
          </Link>
        ) : null}
      </div>
    );
  }

  const [texto, estimativa] = await Promise.all([usoDoDia(userId, hojeSaoPaulo(), "texto"), usoDoDia(userId, hojeSaoPaulo(), "estimativa")]);
  return (
    <div className="space-y-6">
      <Voltar href={`/comida/adicionar${volta}`} />
      <h1 className="text-3xl font-black">{ROTULOS_REFEICAO[ref]}</h1>
      <FluxoRefeicao
        data={data}
        refeicao={ref}
        rotuloRefeicao={ROTULOS_REFEICAO[ref]}
        gratuito={planoGratuito({ IA_PLANO: process.env.IA_PLANO })}
        restanteTexto={texto.limite - texto.usadas}
        restanteEstimativa={estimativa.limite - estimativa.usadas}
      />
    </div>
  );
}
