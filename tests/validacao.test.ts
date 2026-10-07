import { describe, expect, it } from "vitest";
import { cadastroSchema, entrarSchema, novaSenhaSchema, recuperarSchema, verificarSchema } from "@/lib/validacao/auth";
import { adicionarSchema, alimentoUsuarioSchema, buscaSchema, medidaSchema } from "@/lib/validacao/comida";
import { metaSchema } from "@/lib/validacao/metas";
import { hojeSaoPaulo } from "@/lib/datas";
import { somarDias } from "@/lib/datas";
import { perfilSchema } from "@/lib/validacao/perfil";

const perfilVazio = {
  nome: "",
  dataNascimento: "",
  sexo: "",
  alturaCm: "",
  nivelAtividade: "",
  inicioPlano: "",
};
const metaVazia = {
  kcal: "",
  proteinaG: "",
  carboG: "",
  gorduraG: "",
  aguaMl: "",
  pesoMetaKg: "",
  dataMeta: "",
  observacao: "",
};

describe("perfil", () => {
  it("aceita perfil vazio (tudo opcional) e converte vazio em null", () => {
    const r = perfilSchema.parse(perfilVazio);
    expect(Object.values(r).every((v) => v === null)).toBe(true);
  });

  it("aceita valores nos limites e altura com vírgula", () => {
    const r = perfilSchema.parse({
      ...perfilVazio,
      nome: "  Rafael  ",
      dataNascimento: "1900-01-01",
      sexo: "masculino",
      alturaCm: "175,5",
      nivelAtividade: "muito_alto",
    });
    expect(r.nome).toBe("Rafael");
    expect(r.alturaCm).toBe(175.5);
    expect(perfilSchema.parse({ ...perfilVazio, alturaCm: "100" }).alturaCm).toBe(100);
    expect(perfilSchema.parse({ ...perfilVazio, alturaCm: "250" }).alturaCm).toBe(250);
  });

  it.each([
    ["altura 99,9", { alturaCm: "99,9" }],
    ["altura 250,1", { alturaCm: "250,1" }],
    ["altura com 2 casas", { alturaCm: "175,55" }],
    ["altura negativa", { alturaCm: "-175" }],
    ["altura com letras", { alturaCm: "1,7m" }],
    ["nome com 81 caracteres", { nome: "a".repeat(81) }],
    ["nascimento antes de 1900", { dataNascimento: "1899-12-31" }],
    ["nascimento no futuro", { dataNascimento: "2999-01-01" }],
    ["data inexistente", { dataNascimento: "2020-02-30" }],
    ["data em outro formato", { dataNascimento: "01/01/1990" }],
    ["sexo fora da lista", { sexo: "outro" }],
    ["nível fora da lista", { nivelAtividade: "extremo" }],
  ])("recusa %s", (_, campo) => {
    expect(perfilSchema.safeParse({ ...perfilVazio, ...campo }).success).toBe(false);
  });
});

describe("metas", () => {
  it("exige pelo menos uma meta preenchida", () => {
    expect(metaSchema.safeParse(metaVazia).success).toBe(false);
  });

  it("aceita os limites exatos", () => {
    const r = metaSchema.parse({
      kcal: "500",
      proteinaG: "0",
      carboG: "1500",
      gorduraG: "500",
      aguaMl: "10000",
      pesoMetaKg: "20",
      dataMeta: "2027-01-01",
      observacao: "x".repeat(500),
    });
    expect(r.kcal).toBe(500);
    expect(r.pesoMetaKg).toBe(20);
    expect(metaSchema.parse({ ...metaVazia, kcal: "10000", pesoMetaKg: "400,0" }).pesoMetaKg).toBe(400);
  });

  it.each([
    ["kcal 499", { kcal: "499" }],
    ["kcal 10001", { kcal: "10001" }],
    ["kcal decimal", { kcal: "1800,5" }],
    ["kcal negativa", { kcal: "-1800" }],
    ["proteína 501", { proteinaG: "501" }],
    ["carboidrato 1501", { carboG: "1501" }],
    ["gordura 501", { gorduraG: "501" }],
    ["água 10001", { aguaMl: "10001" }],
    ["peso-meta 19,9", { pesoMetaKg: "19,9" }],
    ["peso-meta 400,1", { pesoMetaKg: "400,1" }],
    ["número enorme", { kcal: "99999999999" }],
    ["texto no número", { proteinaG: "abc" }],
    ["notação científica", { kcal: "1e3" }],
    ["observação com 501 caracteres", { observacao: "x".repeat(501) }],
    ["data da meta inválida", { kcal: "1800", dataMeta: "amanhã" }],
  ])("recusa %s", (_, campo) => {
    expect(metaSchema.safeParse({ ...metaVazia, ...campo }).success).toBe(false);
  });
});

describe("autenticação", () => {
  it("normaliza o e-mail", () => {
    expect(entrarSchema.parse({ email: " Rafa@Exemplo.COM ", senha: "x" }).email).toBe("rafa@exemplo.com");
  });

  it.each([
    ["e-mail inválido", entrarSchema, { email: "rafa", senha: "x" }],
    ["senha vazia", entrarSchema, { email: "a@b.com", senha: "" }],
    ["senha enorme", entrarSchema, { email: "a@b.com", senha: "x".repeat(129) }],
    ["senha curta no cadastro", cadastroSchema, { nome: "R", email: "a@b.com", senha: "123456789" }],
    ["nome vazio no cadastro", cadastroSchema, { nome: "  ", email: "a@b.com", senha: "1234567890" }],
    ["código com 5 números", verificarSchema, { email: "a@b.com", codigo: "12345" }],
    ["código com letras", verificarSchema, { email: "a@b.com", codigo: "12a456" }],
    ["e-mail inválido na recuperação", recuperarSchema, { email: "nao-e-email" }],
    ["nova senha curta", novaSenhaSchema, { email: "a@b.com", codigo: "123456", senha: "curta", confirmacao: "curta" }],
    ["confirmação diferente", novaSenhaSchema, { email: "a@b.com", codigo: "123456", senha: "1234567890", confirmacao: "1234567891" }],
    ["código inválido na nova senha", novaSenhaSchema, { email: "a@b.com", codigo: "abc", senha: "1234567890", confirmacao: "1234567890" }],
  ] as const)("recusa %s", (_, schema, dados) => {
    expect(schema.safeParse(dados).success).toBe(false);
  });
});

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("comida", () => {
  const base = { data: "2026-01-10", refeicao: "almoco", tipo: "base", alimentoId: UUID };

  it("aceita gramas e medida válidas", () => {
    expect(adicionarSchema.safeParse({ ...base, quantidade: { modo: "gramas", gramas: "150,5" } }).success).toBe(true);
    expect(adicionarSchema.safeParse({ ...base, quantidade: { modo: "medida", medidaId: UUID, quantidade: "1,5" } }).success).toBe(true);
  });

  it.each([
    ["gramas 0", { ...base, quantidade: { modo: "gramas", gramas: "0" } }],
    ["gramas 5001", { ...base, quantidade: { modo: "gramas", gramas: "5001" } }],
    ["gramas negativas", { ...base, quantidade: { modo: "gramas", gramas: "-5" } }],
    ["gramas com texto", { ...base, quantidade: { modo: "gramas", gramas: "1e3" } }],
    ["quantidade de medida 51", { ...base, quantidade: { modo: "medida", medidaId: UUID, quantidade: "51" } }],
    ["refeição inválida", { ...base, refeicao: "brunch", quantidade: { modo: "gramas", gramas: "100" } }],
    ["tipo inválido", { ...base, tipo: "outro", quantidade: { modo: "gramas", gramas: "100" } }],
    ["id inválido", { ...base, alimentoId: "1 or 1=1", quantidade: { modo: "gramas", gramas: "100" } }],
    ["data futura", { ...base, data: "2999-01-01", quantidade: { modo: "gramas", gramas: "100" } }],
    ["data antiga", { ...base, data: "1999-12-31", quantidade: { modo: "gramas", gramas: "100" } }],
  ])("recusa %s", (_, dados) => {
    expect(adicionarSchema.safeParse(dados).success).toBe(false);
  });

  it("hoje é aceito e amanhã não", () => {
    const q = { modo: "gramas", gramas: "100" };
    expect(adicionarSchema.safeParse({ ...base, data: hojeSaoPaulo(), quantidade: q }).success).toBe(true);
    expect(adicionarSchema.safeParse({ ...base, data: somarDias(hojeSaoPaulo(), 1), quantidade: q }).success).toBe(false);
  });

  it.each([
    ["gramas 0", { tipo: "base", alimentoId: UUID, nome: "concha", gramas: "0" }],
    ["gramas 2001", { tipo: "base", alimentoId: UUID, nome: "concha", gramas: "2001" }],
    ["nome vazio", { tipo: "base", alimentoId: UUID, nome: " ", gramas: "140" }],
    ["nome com 41", { tipo: "base", alimentoId: UUID, nome: "x".repeat(41), gramas: "140" }],
  ])("medida: recusa %s", (_, dados) => {
    expect(medidaSchema.safeParse(dados).success).toBe(false);
  });

  it("rótulo: aceita porção qualquer e recusa limites", () => {
    const ok = { nome: "Granola", marca: "", porcaoG: "40", kcal: "180", proteinaG: "4", carboG: "28", gorduraG: "5,5", fibraG: "3", sodioMg: "" };
    expect(alimentoUsuarioSchema.safeParse(ok).success).toBe(true);
    expect(alimentoUsuarioSchema.safeParse({ ...ok, porcaoG: "0" }).success).toBe(false);
    expect(alimentoUsuarioSchema.safeParse({ ...ok, nome: "" }).success).toBe(false);
    expect(alimentoUsuarioSchema.safeParse({ ...ok, nome: "x".repeat(121) }).success).toBe(false);
    expect(alimentoUsuarioSchema.safeParse({ ...ok, kcal: "" }).success).toBe(false);
    expect(alimentoUsuarioSchema.safeParse({ ...ok, proteinaG: "abc" }).success).toBe(false);
  });

  it("busca: tamanho do texto", () => {
    expect(buscaSchema.safeParse("a").success).toBe(false);
    expect(buscaSchema.safeParse("x".repeat(61)).success).toBe(false);
    expect(buscaSchema.safeParse("arroz").success).toBe(true);
  });
});
