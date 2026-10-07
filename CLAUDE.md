# FuelLift – instruções para o Claude Code

App pessoal de treino + nutrição. Antes de começar qualquer fase, leia:

- `docs/SPEC.md` – o que o app faz
- `docs/SEGURANCA.md` – regras de segurança obrigatórias

## Como trabalhar

- Trabalhe **somente na fase pedida**. Ao começar uma fase, apresente o plano (arquivos, tabelas, telas, pacotes) e espere minha aprovação antes de escrever código.
- Se uma regra de negócio não estiver clara, pergunte. Não preencha lacunas com suposições.
- **Nunca invente funções, métodos, opções ou pacotes.** Confira a documentação oficial atual e as versões instaladas no `package.json`. Se não tiver certeza de que algo existe, diga isso.
- Ao final de cada fase: relatório de segurança (seção 11 do `docs/SEGURANCA.md`), como testar no iPhone e o que ficou pendente.
- Commits pequenos e descritivos, em português. Nunca commitar segredos.

## Stack

Next.js (App Router) + React + TypeScript + Tailwind, Neon (Postgres) com Neon Auth, Drizzle ORM, deploy no Vercel via GitHub, PWA instalável no iPhone.

## Regras técnicas

- Todo acesso a dados passa pela camada `lib/dal/`, que recebe o `user_id` da sessão (ver `docs/SEGURANCA.md`).
- Toda alteração de banco vira migration versionada no repositório.
- Cálculos (nutrientes, gasto calórico, projeção de peso, tendência) ficam em funções puras em `lib/`, com testes unitários.
- Registros alimentares guardam os nutrientes calculados no momento do registro (snapshot).
- Datas tratadas no fuso America/Sao_Paulo.

## Interface

- Português do Brasil, linguagem simples.
- Mobile-first para iPhone: respeitar a área segura (notch e barra inferior) e alvos de toque grandes.
- Estilo minimalista, alto contraste, guiado pela tipografia. Nada com cara de template genérico.
- Não usar campos numéricos com setinhas nativas. Para configurações, usar o padrão botão "Editar" → modo de edição → "Salvar". Durante o treino, usar botões de + e −.

## Saúde

- Metas de calorias, proteína, carboidrato e gordura: a IA pode **sugerir** valores com base em peso, altura, idade, sexo, nível de atividade, treino e meta de peso, mostrando o cálculo e deixando claro que é uma estimativa. A meta só passa a valer depois que o usuário confirma (e pode ajustá-la com o nutricionista). O app nunca grava uma meta sozinho.
- Nunca sugerir déficits agressivos: ritmo de perda acima de ~1% do peso por semana (configurável) ou consumo abaixo do gasto em repouso estimado não é sugerido e gera aviso para conversar com o nutricionista.
- Alimentos fora do banco: a IA pode estimar os nutrientes, sempre marcados como "estimativa da IA". O usuário confere, ajusta e confirma; o item vira um alimento do usuário, editável.
- Gasto calórico, projeções e estimativas da IA são sempre apresentados como estimativas.
- Nada é salvo a partir da IA sem confirmação do usuário.

@AGENTS.md
