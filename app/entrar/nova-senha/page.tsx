import { FormNovaSenha } from "../formularios";

export const metadata = { title: "Nova senha · Fuelift" };

export default function PaginaNovaSenha() {
  return (
    <>
      <h1 className="text-3xl font-bold">Nova senha</h1>
      <p className="mt-3 mb-10 text-suave">
        Se houver uma conta com esse e-mail, o código chega em instantes. Ele vale por pouco tempo.
      </p>
      <FormNovaSenha />
    </>
  );
}
