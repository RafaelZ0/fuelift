import { EmBreve } from "@/components/em-breve";
import { exigirUsuario } from "@/lib/auth/sessao";

export const metadata = { title: "Treino · FuelLift" };

export default async function Pagina() {
  await exigirUsuario();
  return <EmBreve titulo="Treino" texto="O plano de treino chega em uma próxima fase." />;
}
