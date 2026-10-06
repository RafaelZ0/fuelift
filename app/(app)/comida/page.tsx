import { EmBreve } from "@/components/em-breve";
import { exigirUsuario } from "@/lib/auth/sessao";

export const metadata = { title: "Comida · FuelLift" };

export default async function Pagina() {
  await exigirUsuario();
  return <EmBreve titulo="Comida" texto="O diário alimentar chega na próxima fase." />;
}
