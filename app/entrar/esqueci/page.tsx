import { FormEsqueci } from "../formularios";

export const metadata = { title: "Esqueci a senha · Fuelift" };

export default function PaginaEsqueci() {
  return (
    <>
      <h1 className="text-3xl font-bold">Esqueci a senha</h1>
      <p className="mt-3 mb-10 text-suave">Vamos enviar um código de 6 números para o seu e-mail.</p>
      <FormEsqueci />
    </>
  );
}
