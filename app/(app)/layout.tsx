import { exigirUsuario } from "@/lib/auth/sessao";
import { BarraAbas } from "./barra-abas";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  // Barreira de UX. Cada página e Server Action verifica a sessão de novo.
  await exigirUsuario();
  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <main className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BarraAbas />
    </div>
  );
}
