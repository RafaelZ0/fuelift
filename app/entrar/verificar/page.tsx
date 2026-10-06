import { FormVerificar } from "../formularios";

export const metadata = { title: "Confirmar e-mail · FuelLift" };

export default function PaginaVerificar() {
  return (
    <>
      <h1 className="text-3xl font-bold">Confirme seu e-mail</h1>
      <p className="mt-3 mb-10 text-suave">Enviamos um código de 6 números para o seu e-mail.</p>
      <FormVerificar />
    </>
  );
}
