import { EmBreve } from "@/components/em-breve";
import { exigirUsuario } from "@/lib/auth/sessao";

export const metadata = { title: "Progresso · Fuelift" };

export default async function Pagina() {
  await exigirUsuario();
  return <EmBreve titulo="Progresso" texto="Peso, medidas e gráficos chegam em uma próxima fase." />;
}
