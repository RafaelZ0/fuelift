import { describe, expect, it } from "vitest";
import { ESQUEMA_RELATORIO, hashDoRelatorio, INSTRUCAO_SISTEMA_RELATORIO, montarEntradaRelatorio, numerosDoRelatorio, sanitizarResumo } from "@/lib/ia/relatorio";
import { montarRelatorioSemanal, type EntradaRelatorio } from "@/lib/relatorio";

const dia = (n: number) => new Date(Date.UTC(2026, 9, 5 + n)).toISOString().slice(0, 10);
const entrada: EntradaRelatorio = {
  inicio: "2026-10-05",
  hoje: "2026-10-12",
  consumo: Array.from({ length: 7 }, (_, i) => ({ data: dia(i), kcal: 2000 + i * 50, proteinaG: 140 })),
  metaKcal: 2100,
  metaProteinaG: 150,
  pesagens: [
    { data: dia(-3), peso: 90.8 },
    { data: dia(0), peso: 90.6 },
    { data: dia(4), peso: 90.0 },
    { data: dia(6), peso: 89.8 },
  ],
  sessoes: [{ data: dia(0), status: "feito" }, { data: dia(2), status: "faltou" }],
  treinosPlanejados: 3,
  passos: [{ data: dia(0), passos: 8000 }],
  gasto: { valor: 2400, minimo: 2200, maximo: 2600, metodo: "adaptativo" },
};
const r = montarRelatorioSemanal(entrada);

describe("resumo da semana pela IA", () => {
  it("a entrada traz só números do relatório, em formato fixo, sem identificadores", () => {
    const t = montarEntradaRelatorio(r);
    expect(t).toContain("calorias médias por dia: 2.150 kcal em 7 dias com registro");
    expect(t).toContain("treinos feitos: 1; faltas: 1");
    expect(t).not.toMatch(/@|user_id|uuid/i);
  });
  it("aceita texto que cita só números do relatório", () => {
    const ok = sanitizarResumo({ explicacao: "Você comeu em média 2150 kcal por dia, perto da meta de 2100 kcal, e treinou 1 vez com 1 falta. A proteína ficou em 140 g por dia, abaixo dos 150 g da meta.", dicas: ["Tente chegar aos 150 g de proteína."] }, r);
    expect(ok?.dicas).toHaveLength(1);
  });
  it("descarta texto que inventa número (nova meta, perda esperada, soma)", () => {
    expect(sanitizarResumo({ explicacao: "O ideal seria comer 1800 kcal por dia para acelerar o resultado nas próximas semanas." }, r)).toBeNull();
    expect(sanitizarResumo({ explicacao: "Você acumulou 1750 kcal de déficit esta semana e vai perder 3,5 kg no mês que vem." }, r)).toBeNull();
    expect(sanitizarResumo({ explicacao: "Você comeu 2150 kcal por dia, muito bem.", dicas: ["Beba 3,5 litros de água."] }, r)).toBeNull();
  });
  it("recusa formato inválido ou texto vazio", () => {
    for (const ruim of [null, "texto", [], {}, { explicacao: "curto" }]) expect(sanitizarResumo(ruim, r)).toBeNull();
  });
  it("hash muda quando os números mudam e não depende do texto", () => {
    const outro = montarRelatorioSemanal({ ...entrada, consumo: entrada.consumo.map((d) => ({ ...d, kcal: 1900 })) });
    expect(hashDoRelatorio(r)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoRelatorio(r)).toBe(hashDoRelatorio(montarRelatorioSemanal(entrada)));
    expect(hashDoRelatorio(outro)).not.toBe(hashDoRelatorio(r));
  });
  it("números permitidos incluem os do relatório e o ano", () => {
    const n = numerosDoRelatorio(r);
    expect(n.has(2150)).toBe(true);
    expect(n.has(2400)).toBe(true);
    expect(n.has(2026)).toBe(true);
    expect(n.has(1800)).toBe(false);
  });
  it("instrução proíbe inventar números e dar conselho médico", () => {
    expect(INSTRUCAO_SISTEMA_RELATORIO).toMatch(/APENAS os números fornecidos/);
    expect(INSTRUCAO_SISTEMA_RELATORIO).toMatch(/Não dê conselho médico/);
    expect(JSON.stringify(ESQUEMA_RELATORIO)).not.toMatch(/maxItems|\$ref|additionalProperties/);
  });
});
