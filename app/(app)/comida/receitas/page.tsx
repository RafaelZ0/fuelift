import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarReceitas } from "@/lib/dal/receitas";
import { Voltar } from "../comum";

export const metadata = { title: "Receitas · Kalyft" };

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default async function PaginaReceitas() {
  const { userId } = await exigirUsuario();
  const lista = await listarReceitas(userId);
  return (
    <div className="space-y-8">
      <Voltar href="/comida" />
      <h1 className="text-3xl font-black">Receitas</h1>
      <p className="text-lg text-suave">Monte uma receita com os ingredientes e quantas porções ela rende. Ela vira um alimento seu, com a medida &quot;porção&quot;, para registrar no diário.</p>
      <Link href="/comida/receitas/nova" className="flex min-h-14 items-center justify-center rounded-full bg-destaque text-lg font-bold text-sobre-destaque">
        Nova receita
      </Link>
      {lista.length === 0 ? (
        <p className="text-suave">Você ainda não tem receitas.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map((r) => {
            const porPorcao = r.kcalPor100g !== null ? (r.kcalPor100g * (r.pesoFinalG / r.porcoes)) / 100 : null;
            return (
              <li key={r.id}>
                <Link href={`/comida/receitas/${r.id}`} className="block rounded-2xl border-2 border-linha p-4 active:border-marca">
                  <span className="block text-lg font-bold">{r.nome}</span>
                  <span className="block text-sm text-suave">
                    {r.porcoes.toLocaleString("pt-BR")} {r.porcoes === 1 ? "porção" : "porções"}
                    {porPorcao !== null ? ` · ≈ ${n(porPorcao)} kcal por porção` : " · sem alimento ligado (abra e salve de novo)"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
