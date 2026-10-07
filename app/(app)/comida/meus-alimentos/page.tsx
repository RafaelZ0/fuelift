import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarMeusAlimentos } from "@/lib/dal/alimentos";
import { formatarKcal } from "@/lib/nutricao";
import { Voltar } from "../comum";

export const metadata = { title: "Meus alimentos · FuelLift" };

export default async function PaginaMeusAlimentos() {
  const { userId } = await exigirUsuario();
  const alimentos = await listarMeusAlimentos(userId);
  return (
    <div className="space-y-6">
      <Voltar href="/comida" />
      <h1 className="text-3xl font-black">Meus alimentos</h1>
      <Link href="/comida/meus-alimentos/novo" className="flex min-h-14 items-center justify-center rounded-full bg-destaque text-lg font-bold text-fundo">
        + Cadastrar pelo rótulo
      </Link>
      {alimentos.length === 0 ? (
        <p className="text-suave">Você ainda não cadastrou alimentos.</p>
      ) : (
        <ul>
          {alimentos.map((a) => (
            <li key={a.id}>
              <Link href={`/comida/meus-alimentos/${a.id}`} className="flex min-h-14 items-center justify-between gap-4 border-b border-linha py-2">
                <span>
                  <span className="block font-medium">{a.nome}</span>
                  {a.marca ? <span className="text-sm text-suave">{a.marca}</span> : null}
                </span>
                <span className="shrink-0 text-sm text-suave">{formatarKcal(a.kcal)} kcal/100 g</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
