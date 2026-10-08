# Kalyft – Fase 3A: relatório de segurança (seção 11 do SEGURANCA.md)

Data: 08/10/2026. Escopo: motor de treino (plano manual, execução com cronômetro, agenda, faltas, calendário, evolução), água, pesagens e aplicação semanal. Situação: pronta e testada nos branches `dev` e `test`. **Produção ainda não recebeu** a migration `0006` nem o código (aguarda aprovação).

## 1. Rotas e Server Actions novas

Continua sem Route Handlers que recebam dados. Toda página e Server Action chama `exigirUsuario()` (sessão válida, acesso aprovado, `user_id` só da sessão).

### Páginas

| Rota | O que faz | Autorização |
|---|---|---|
| `/treino` | Treino do dia (agenda ou troca), status, falta, troca do dia | Só dados do próprio `user_id`; data validada (futuro ou inválido vira hoje) |
| `/treino/sessao` | Execução: séries, substitutos, dica de progressão, cronômetro | Idem; data até hoje |
| `/treino/falta` | Registrar falta com motivo | Idem |
| `/treino/plano` | Plano, treinos, exercícios do treino, substitutos, agenda | Só o plano do próprio usuário |
| `/treino/exercicios`, `/treino/exercicios/[id]` | Exercícios, evolução, edição | `id` validado como uuid; de outro usuário = 404 |
| `/treino/calendario` | Calendário mensal e estatísticas | Mês validado por expressão regular |
| `/comida` | Painel de água (novo) | Só a água do próprio usuário |
| `/progresso` | Peso, tendência, massa magra, cintura, aplicação semanal | Só dados do próprio usuário |

### Server Actions (24 novas)

| Arquivo | Actions | Validação (Zod no servidor) |
|---|---|---|
| `treino/actions.ts` | salvarExercicio, apagarExercicio, salvarPlano, salvarTreino, apagarTreino, adicionarExercicioAoTreino, removerExercicioDoTreino, adicionarSubstitutoAoItem, removerSubstitutoDoItem, definirAgendaDoDia, trocarTreinoDoDia, salvarSerieDoDia, apagarSerieDoDia, concluirTreino, registrarFaltaDoDia, desfazerRegistroDoDia | Nomes ≤ 80, séries 1–20, repetições 1–1000 (mín ≤ máx), descanso 0–600 s, carga 0–1000 kg, segundos 0–7200, motivos só da lista, ids uuid, datas até hoje |
| `comida/agua.ts` | adicionarAgua, adicionarAguaLivre, desfazerAgua | 1 a 5000 ml, data até hoje |
| `progresso/actions.ts` | salvarPesagem, apagarPesagem, marcarAplicacao, desfazerAplicacao, salvarDiaAplicacao | Peso 20–400 kg, massa magra 5–300 kg e ≤ peso, cintura 30–300 cm, dia da semana 0–6 |

- Em nenhuma action o `user_id` vem do formulário.
- `salvarSerieDoDia` é chamada pelo botão "Feito" com um objeto (não um formulário): os números são convertidos em texto e passam pelo mesmo Zod.
- Na DAL todo select, update e delete filtra por `user_id`.

### Defesa em profundidade no banco

- Chaves por **(id, user_id)** em todas as ligações: treino → plano, exercício do treino → treino e exercício, substituto, agenda, troca, sessão → treino, série → sessão e exercício. **O banco recusa** qualquer referência a dado de outro usuário.
- Um plano ativo por usuário (índice único parcial).
- Ao apagar um **treino**, as sessões antigas ficam (histórico) e só perdem o vínculo. Ao apagar um **exercício**, as séries dele são apagadas junto; a tela avisa antes.
- CHECKs repetem todos os limites do Zod; a foto só aceita letras, números, `_` e `-`.

## 2. Testes

- **Banco (branch `test`, papel do app): 94 de 94.** Os 62 anteriores e 32 novos: A não lê, não altera e não apaga exercícios, plano, treinos, itens, sessões, séries, água, pesagens e aplicação de B; o banco recusa A criar treino no plano de B, usar exercício ou treino de B, registrar série com dados de B e apontar agenda e troca para treino de B; um plano ativo por usuário; sessão fica após apagar o treino; 15 CHECKs.
- **Unitários: 153 de 153.** Cobrem readaptação (2 séries nas semanas 1–3, 3 depois), treino do dia com troca, dica de progressão, calendário, estatísticas, sequência, tendência do peso, aplicação, cronômetro por hora de fim, URL das fotos e todos os limites de validação.
- **Defeito encontrado pelos testes e corrigido:** a validação de números inteiros gerava uma expressão regular inválida e derrubaria o módulo na primeira execução. O build não detecta isso; só o teste.
- **Teste manual (conta sintética no `dev`, apagada no fim):** criar exercícios, plano, treino, substituto e agenda; execução com + e −, série feita, cronômetro (+15 s e Pular); falta com motivo; calendário; água (botões, valor livre, desfazer e recusa de 6000 ml); pesagens, gráfico e recusa de massa magra maior que o peso. Um ajuste feito: dias antes do início do plano não aparecem como "sem registro".

## 3. `npm audit`

Igual às fases anteriores. **Nenhum pacote novo** (gráficos em SVG próprio).

| | Moderadas | Altas |
|---|---|---|
| tudo | 4 | 5 |
| `--omit=dev` | 4 | 0 |

Só ferramentas de desenvolvimento (`eslint-config-next` e `drizzle-kit`). Nada disso vai para o Vercel.

## 4. Segredos e código provisório

- Código atual e histórico do git: nenhuma URL com senha, chave ou token.
- Nenhum TODO, rota de teste, bypass, `dangerouslySetInnerHTML` ou `console.log`.
- Todo arquivo que lê segredo importa `server-only` (o `proxy.ts` só lê `NODE_ENV`).
- A conta sintética foi apagada: 0 usuários, 0 exercícios, 0 séries, 0 sessões, 0 registros de água e de peso restantes.

## 5. Regras não cumpridas ou parciais

| Regra | Situação |
|---|---|
| CSP e imagens de terceiros | **Mudança:** `img-src` agora também libera `https://raw.githubusercontent.com` (fotos do Free Exercise DB, domínio público). Só imagens, só esse endereço; sem script, estilo ou conexão. As imagens usam `no-referrer`. A URL só é montada com um id validado. |
| §5 limites de taxa | As ações de treino, água e corpo não têm limite de taxa: exigem login aprovado e gravam só no espaço do usuário. Risco baixo (igual à Fase 2). |
| Aviso sonoro com a tela apagada | **Não é possível** sem notificação push. Com a tela acesa, toca; no iPhone o som só funciona depois de um toque na tela; vibração não existe no iPhone. |
| Tela acesa durante o treino | Só no iOS 18.4 ou mais novo, com o app instalado. Em versões anteriores a tela pode apagar. |
| Importação do backup do "Meu Treino" | **Pendente:** você não tem o arquivo agora. |
| Busca de fotos no catálogo do Free Exercise DB | **Pendente:** hoje o id da foto é digitado. A ligação automática (pela IA) fica para a etapa 3B. |
| Agenda e histórico | A agenda vale também para dias passados (a partir do início do plano): trocar a agenda hoje muda como os dias passados aparecem no calendário ("sem registro"). As sessões já registradas não mudam. |
| E-mail próprio (SMTP) no Neon Auth | Continua pendente desde a Fase 1. |

Todas as outras regras foram cumpridas.

## 6. Como testar no iPhone (depois do deploy)

1. **Treino → Exercícios:** cadastre alguns exercícios (Supino, Agachamento...). Opcional: o id da foto (ex.: `Barbell_Squat`).
2. **Treino → Plano:** crie o plano, adicione um treino, os exercícios (séries vazias usam a fase de readaptação) e a agenda da semana.
3. **Treino:** toque em "Começar treino". Ajuste carga e repetições com + e −, toque em "Feito" e confira o cronômetro, o +15 s e o aviso sonoro (a tela precisa estar acesa).
4. Confira o calendário, uma falta com motivo e a evolução de um exercício.
5. **Comida:** água com +200, +300, +500 e valor livre.
6. **Progresso:** pesagens, gráfico e lembrete da aplicação.
7. Confira o teclado numérico, a área segura e a barra inferior.

## 7. Pendências e próximos passos

1. Você revisa este relatório.
2. Aplicar a migration `0006` no Neon de produção, enviar o código ao GitHub e conferir o deploy (aguarda sua aprovação).
3. Etapa **3B**: criar plano com a IA e importar treino de arquivo ou print (exige projeto no Google Cloud com cobrança ativa e a seção 9 do SEGURANCA.md).
4. Importar o backup do "Meu Treino" quando você tiver o arquivo.
