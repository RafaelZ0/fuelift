import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth/sessao";
import { FormEntrar } from "./formularios";

export const metadata = { title: "Entrar · Kalyft" };

export default async function PaginaEntrar() {
  if (await obterSessao()) redirect("/hoje");
  return (
    <>
      <h1 className="mb-10 text-3xl font-bold">Entrar</h1>
      <FormEntrar />
    </>
  );
}
