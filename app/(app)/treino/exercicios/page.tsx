import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarExercicios } from "@/lib/dal/treino";
import { CREDITO_FOTOS } from "@/lib/fotos";
import { FormExercicio } from "./form-exercicio";

export const metadata = { title: "Exercícios · Kalyft" };

export default async function PaginaExercicios() {
  const { userId } = await exigirUsuario();
  const lista = await listarExercicios(userId);
  return (
    <div className="space-y-8">
      <Link href="/treino" className="inline-flex min-h-11 items-center font-semibold text-suave">
        ‹ Voltar
      </Link>
      <h1 className="text-3xl font-black">Exercícios</h1>
      {lista.length > 0 ? (
        <ul>
          {lista.map((e) => (
            <li key={e.id}>
              <Link href={`/treino/exercicios/${e.id}`} className="flex min-h-14 items-center justify-between gap-4 border-b border-linha py-2">
                <span>
                  <span className="block font-medium">{e.nome}</span>
                  <span className="text-sm text-suave">
                    {[e.grupo, e.unilateral ? "unilateral" : null, e.cargaPorHalter ? "carga por halter" : null, e.medida === "segundos" ? "em segundos" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-sm text-suave">Evolução ›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-suave">Você ainda não cadastrou exercícios.</p>
      )}
      <section aria-labelledby="novo" className="space-y-4 border-t border-linha pt-8">
        <h2 id="novo" className="text-2xl font-bold">Novo exercício</h2>
        <FormExercicio />
      </section>
      <p className="text-xs text-suave">{CREDITO_FOTOS}</p>
    </div>
  );
}
