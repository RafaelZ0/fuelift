# FuelLift – Fase 2: relatório de segurança (seção 11 do SEGURANCA.md)

Data: 07/10/2026. Situação: pronta e testada nos branches `dev` e `test`. **Produção ainda não recebeu** as migrations, a TACO nem o código desta fase (aguarda aprovação).

## 1. Rotas, Server Actions e endpoints novos

Continua sem Route Handlers que recebam dados (nenhum `/api/*`). Toda página e Server Action da aba Comida chama `exigirUsuario()`: sessão válida, acesso aprovado e `user_id` vindo **só** da sessão.

### Páginas (todas exigem `exigirUsuario()`)

| Rota | O que mostra | Autorização |
|---|---|---|
| `/comida?data=` | Dia, totais × meta vigente, 5 refeições | Só registros e meta do próprio `user_id`. Data validada: futura ou inválida vira "hoje". |
| `/comida/adicionar` | Busca, favoritos, recentes | Só os do próprio usuário (mais a TACO, que é pública). |
| `/comida/alimento/[tipo]/[id]` | Alimento, medidas, favorito | `tipo` e `id` validados (Zod/uuid). Alimento de outro usuário = 404. |
| `/comida/registro/[id]` | Editar ou apagar registro | Registro de outro usuário = 404. |
| `/comida/meus-alimentos`, `/novo`, `/[id]` | Alimentos do rótulo | Só os do próprio usuário. |
| `/comida/refeicoes` | Refeições salvas | Só as do próprio usuário. |
| `/comida/copiar` | Copiar refeição de outro dia | — |

### Server Actions (`app/(app)/comida/actions.ts`)

| Action | Validação (Zod no servidor) | Autorização |
|---|---|---|
| `buscar` | texto de 2 a 60 caracteres | Limite de 120 buscas/min por usuário; no máximo 20 resultados; LIKE com `%` e `_` escapados; consulta parametrizada. |
| `adicionar` | data (2000-01-01 até hoje), refeição, tipo, uuid; gramas 0,1–5000 ou medida × 0,1–50 | Alimento e medida conferidos na DAL por `user_id`. Nutrientes **calculados no servidor**; kcal ≤ 10.000 por item. |
| `editarRegistro` | uuid, refeição, gramas 0,1–5000 | `where id and user_id`. |
| `apagarRegistro` | uuid | `where id and user_id`. |
| `favoritar` | tipo, uuid | O alimento precisa ser visível ao usuário; o banco recusa favoritar alimento de outro. |
| `salvarMedida` | nome 1–40, gramas 0,1–2000 | Idem; o banco recusa medida em alimento de outro. |
| `apagarMedida` | uuid | `where id and user_id`. |
| `salvarAlimento` | nome 1–120, marca ≤80, porção 1–2000 g, valores da porção | Conversão para 100 g no servidor, com teto de 900 kcal, 100 g por macro, soma dos macros ≤ 100,5 g e sódio ≤ 40.000 mg. Edição: `where id and user_id`. |
| `apagarAlimento` | uuid | `where id and user_id`. Os registros antigos ficam com o snapshot. |
| `salvarComoRefeicao` | data, refeição, nome 1–80 | Itens do próprio usuário (no máximo 30). |
| `usarRefeicaoSalva` | uuid, data, refeição | Refeição do próprio usuário; recalcula; alimentos que não existem mais são pulados. |
| `apagarRefeicaoSalva` | uuid | `where id and user_id`. |
| `copiarRefeicao` | duas datas (até hoje) e duas refeições | Recalcula com os valores atuais; alimentos de outro usuário são pulados. |

### Defesa em profundidade no banco

- `alimentos_usuario` e `refeicoes_salvas` têm `unique (id, user_id)`. `medidas`, `favoritos`, `registros_alimentares` e `refeicoes_salvas_itens` apontam para eles por **(id, user_id)**. **O banco recusa** qualquer referência a dado de outro usuário, mesmo com um erro no código.
- O papel `fuelift_app` só tem **SELECT** em `alimentos_base` e `fontes_alimentos`. A escrita foi revogada na migration, porque o `ALTER DEFAULT PRIVILEGES` da Fase 1 a concederia automaticamente.
- CHECKs repetem todos os limites do Zod.

## 2. Testes

- **Isolamento e banco (branch `test`, papel do app): 57 de 57.** São os 24 da Fase 1 e 33 novos, que cobrem:
  - A não lê, não altera e não apaga alimento, medida, registro e refeição salva de B;
  - o banco recusa A criar medida, favorito, registro, refeição salva ou item usando dados de B;
  - busca, lista e recentes de A não mostram dados de B;
  - copiar e recalcular pula alimento de outro usuário;
  - o papel do app não insere, não altera e não apaga na TACO;
  - apagar um alimento mantém o registro, o snapshot e o dono;
  - os CHECKs das tabelas novas funcionam.
- **Unitários: 90 de 90.** Cobrem:
  - cálculo de nutrientes, medida × quantidade, conversão do rótulo para 100 g, arredondamento, totais com "parcial" e comparação com a meta;
  - normalização da busca e escape do LIKE;
  - datas;
  - limites de validação, incluindo data futura;
  - conversão das marcações da TACO;
  - leitura da planilha oficial: 597 alimentos e 15 grupos.
- **Teste manual (conta sintética no `dev`, apagada no fim):** busca com erro de digitação e sem acento, adicionar por gramas e por medida, cadastro pelo rótulo, salvar e usar refeição, copiar para outro dia, editar, apagar, alimento sem calorias bloqueado e data futura recusada. Quatro defeitos foram encontrados e corrigidos:
  - ordem da busca;
  - medida recém-criada sem seleção;
  - contagem de itens da refeição salva;
  - "no ceia".

## 3. Importação da TACO

- **Arquivo:** a planilha oficial do NEPA, 4ª edição, fica em `dados/taco/`, com o SHA-256 conferido a cada importação.
- **Validação:** completa. Se uma linha não passa, nada é gravado.
- **Gravação:** numa única transação.
- **Idempotência:** confirmada. Rodar duas vezes mantém 597.
- **Branches:** importada em `dev` e `test`, com 597 alimentos em cada.
- **Marcações:** padrão FAO/INFOODS. `Tr` e `NA` = 0; `*` e em branco = desconhecido; carboidrato negativo = 0. A marcação original fica guardada.

## 4. `npm audit`

Igual à Fase 1. **Nenhum pacote novo foi instalado** (o leitor da planilha usa só módulos nativos do Node).

| | Moderadas | Altas |
|---|---|---|
| tudo | 4 | 5 |
| `--omit=dev` | 4 | 0 |

São só ferramentas de desenvolvimento (`eslint-config-next`, e `drizzle-kit` via `@esbuild-kit`). Nada disso vai para o Vercel.

## 5. Segredos e código provisório

- **Código atual e histórico do git:** nenhuma URL com senha, chave ou token. O único `.env*` no git é o `.env.example`.
- **`server-only`:** todo arquivo que lê segredo importa `server-only`. O `proxy.ts` só lê `NODE_ENV`, que não é segredo.
- **Código provisório:** nenhum TODO, rota de teste, bypass, `dangerouslySetInnerHTML` ou `console.log`.
- **Contas sintéticas:** as usadas nos testes manuais foram apagadas do `dev`.

## 6. Regras não cumpridas ou parciais

| Regra | Situação |
|---|---|
| §5 limites | A busca tem limite por usuário. As demais ações da Comida não têm limite de taxa: exigem login aprovado e são escritas no próprio espaço do usuário. Risco baixo. |
| §3 limites realistas | Cumprido: carga não se aplica; kcal por item ≤ 10.000; gramas ≤ 5.000; textos com tamanho máximo. |
| Valores complementares da TACO | **Pendente de aprovação.** 4 alimentos estão sem calorias e bloqueados até lá. |
| Medidas oficiais do IBGE | Não importadas. Licença não verificada. |
| E-mail próprio (SMTP) no Neon Auth | Continua pendente desde a Fase 1. |

## 7. Como testar no iPhone (depois do deploy)

1. Abra `fuellift.vercel.app` → aba **Comida**.
2. Toque em "+ Adicionar" no almoço, busque "arroz" (teste também "arros", com erro) e adicione 150 g.
3. Em "Minhas medidas", crie "minha concha = 140 g" no feijão e adicione 1,5 concha.
4. Confira os totais, a barra de meta (defina metas em Ajustes) e a navegação ‹ › entre dias.
5. Em "Mais": salve o almoço como refeição e copie-o para outro dia.
6. Cadastre um alimento pelo rótulo (porção do rótulo, ex.: 30 g).
7. Confira o teclado numérico (sem setinhas) e a área segura.
