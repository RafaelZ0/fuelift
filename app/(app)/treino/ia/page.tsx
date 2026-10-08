import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { corpoParaIa, obterAceiteIa, usoDoDia } from "@/lib/dal/ia";
import { hojeSaoPaulo } from "@/lib/datas";
import { disponibilidadeIa, planoGratuito } from "@/lib/ia/config";
import { VERSAO_ACEITE_IA } from "@/lib/ia/prompts";
import { FormAceite } from "./aceite";
import { FluxoIa } from "./fluxo";

export const metadata = { title: "Treino com IA · Kalyft" };

function Voltar() {
  return (
    <Link href="/treino/plano" className="inline-flex min-h-11 items-center font-semibold text-suave">
      ‹ Voltar
    </Link>
  );
}

export default async function PaginaIa() {
  const { userId, admin } = await exigirUsuario();
  const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, IA_SOMENTE_ADMIN: process.env.IA_SOMENTE_ADMIN, IA_PLANO: process.env.IA_PLANO };
  const d = disponibilidadeIa(env, admin !== null);

  if (!d.ok) {
    return (
      <div className="space-y-6">
        <Voltar />
        <h1 className="text-3xl font-black">Treino com IA</h1>
        <p className="text-lg text-suave">
          {d.motivo === "somente_admin" ? "A IA está liberada só para o administrador por enquanto." : "A IA ainda não está ativada neste app."}
        </p>
      </div>
    );
  }

  const aceite = await obterAceiteIa(userId);
  if (!aceite || aceite.versao < VERSAO_ACEITE_IA) {
    return (
      <div className="space-y-6">
        <Voltar />
        <h1 className="text-3xl font-black">Antes de usar a IA</h1>
        <FormAceite gratuito={planoGratuito(env)} />
      </div>
    );
  }

  const hoje = hojeSaoPaulo();
  const [corpo, usoPlano, usoImportacao] = await Promise.all([corpoParaIa(userId, hoje), usoDoDia(userId, hoje, "plano"), usoDoDia(userId, hoje, "importacao")]);
  return (
    <div className="space-y-8">
      <Voltar />
      <h1 className="text-3xl font-black">Treino com IA</h1>
      <FluxoIa corpo={corpo} restantePlano={usoPlano.limite - usoPlano.usadas} restanteImportacao={usoImportacao.limite - usoImportacao.usadas} />
    </div>
  );
}
