import { z } from "zod";
import { hojeSaoPaulo } from "@/lib/datas";
import {
  dataOpcional,
  decimalOpcional,
  opcaoOpcional,
  textoOpcional,
} from "./comum";

export const SEXOS = ["masculino", "feminino"] as const;
export const NIVEIS_ATIVIDADE = ["sedentario", "leve", "moderado", "alto", "muito_alto"] as const;

export const ROTULOS_NIVEL: Record<(typeof NIVEIS_ATIVIDADE)[number], string> = {
  sedentario: "Sedentário",
  leve: "Leve",
  moderado: "Moderado",
  alto: "Alto",
  muito_alto: "Muito alto",
};

export const CAMPOS_PERFIL = [
  "nome",
  "dataNascimento",
  "sexo",
  "alturaCm",
  "nivelAtividade",
  "inicioPlano",
] as const;

// Mesmos limites dos CHECKs da tabela perfis.
export const perfilSchema = z.object({
  nome: textoOpcional(80, "Nome"),
  dataNascimento: dataOpcional("Data de nascimento", { min: "1900-01-01", max: hojeSaoPaulo }),
  sexo: opcaoOpcional(SEXOS, "Sexo"),
  alturaCm: decimalOpcional(100, 250, "Altura"),
  nivelAtividade: opcaoOpcional(NIVEIS_ATIVIDADE, "Nível de atividade"),
  inicioPlano: dataOpcional("Início do plano", { min: "2000-01-01" }),
});

export type DadosPerfil = z.infer<typeof perfilSchema>;
