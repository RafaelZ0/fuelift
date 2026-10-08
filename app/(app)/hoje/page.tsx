import { EmBreve } from "@/components/em-breve";
import { exigirUsuario } from "@/lib/auth/sessao";

export const metadata = { title: "Hoje · Kalyft" };

export default async function Pagina() {
  await exigirUsuario();
  return <EmBreve titulo="Hoje" texto="Seu resumo do dia aparece aqui em breve." />;
}
