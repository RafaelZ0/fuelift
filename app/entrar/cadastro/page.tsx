import { FormCadastro } from "../formularios";

export const metadata = { title: "Criar conta · Fuelift" };

export default function PaginaCadastro() {
  return (
    <>
      <h1 className="text-3xl font-bold">Criar conta</h1>
      <p className="mt-3 mb-10 text-suave">
        Depois de confirmar o e-mail, sua conta precisa ser aprovada antes do primeiro uso.
      </p>
      <FormCadastro />
    </>
  );
}
