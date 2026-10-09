# Kalyft – Fase 6: relatório de segurança (seção 11 do SEGURANCA.md)

Data: 09/10/2026. Escopo: gasto calórico (fórmula e adaptativo), meta de peso com projeção e travas de segurança, sugestão de metas (a IA só explica), nível de atividade com IA, gráficos de progresso, painel "Hoje" e passos pelo Atalhos do iPhone. Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção** (a migration 0011 e o deploy aguardam aprovação).

## 1. Rotas e Server Actions

Toda página e Server Action chama `exigirUsuario()` (sessão válida, acesso aprovado, `user_id` só da sessão). **Há um Route Handler novo que recebe dados** (`/api/passos`), revisado à parte abaixo.

### Páginas novas ou alteradas

| Rota | O que faz | Autorização |
|---|---|---|
| `/hoje` | Painel do dia: calorias × meta, proteína, água, treino, peso, gasto estimado e passos | Só dados do próprio `user_id` |
| `/progresso` | Gráficos com período (4 semanas, 3 meses, tudo; valor inválido volta para 3 meses) | Idem |
| `/progresso/meta` | Gasto estimado, peso desejado, opções de calorias, projeção, plano × real, ritmo máximo | Idem |
| `/ajustes/atividade` | Nível de atividade (IA sugere, usuário confirma ou escolhe) | Sessão + aceite da IA para a parte de IA |
| `/ajustes/passos` | Chaves da API de passos e passo a passo do Atalhos | Só as chaves do próprio usuário |

### Server Actions (7 novas, 1 alterada)

| Action | Verificações no servidor |
|---|---|
| `salvarPesoMeta` | Sessão; Zod (peso 20 a 400 kg; data mínima = hoje **calculada a cada chamada**; data exige peso); preserva as outras metas |
| `salvarRitmoMax` | Sessão; só aceita 0,25, 0,5, 0,75 ou 1; o banco também recusa fora de 0,25 a 1,00 (o teto de 1% **não pode ser aumentado**) |
| `explicarOpcaoMeta` | Sessão; só recebe QUAL opção (`leve`/`moderado`/`firme`); recalcula tudo do banco; sem IA, sem aceite ou no limite, devolve a **explicação fixa do app**; com IA, o texto que traz número que o app não forneceu é **descartado**; limite diário atômico (tipo `metas`); falha do provedor devolve a chamada |
| `aplicarOpcaoMeta` | Sessão; só a opção; calorias e macros **recalculados no servidor** (qualquer número vindo do formulário é ignorado); opção inexistente (inclusive quando a meta é bloqueada por IMC) não muda nada; guarda a versão da projeção |
| `diagnosticarAtividade` | Sessão + aceite da IA; texto 10 a 500 caracteres, limpo; só o texto e o número de treinos do plano vão à IA; a IA devolve um dos 5 níveis (qualquer outro valor é recusado); limite diário (10) |
| `confirmarAtividade` | Sessão; enum de 5 níveis; o fator numérico é da tabela do app |
| `criarTokenPassos` / `revogarTokenPassos` | Sessão; nome 1 a 40; até 5 chaves ativas; só o hash vai ao banco; revogar chave de outro usuário não funciona |
| `salvarMetas` (alterada) | Agora devolve **aviso** quando a meta digitada passa das travas (abaixo da taxa basal ou ritmo acima do máximo); a meta é salva como digitada (pode ter sido combinada com o nutricionista) |

### `POST /api/passos` (novo, recebe dados)

- **Autenticação por token pessoal** (`Authorization: Bearer kly_…`), não por cookie, então **não há CSRF**. O token tem 256 bits aleatórios; o banco guarda só o SHA-256. Formato conferido antes de qualquer consulta.
- **Limites**: por IP (120 por hora, contado em toda requisição, inclusive inválida) e por chave (60 por hora).
- **Entrada**: só `application/json` (415 caso contrário), corpo até 1 KB (413), passos inteiros de 0 a 200.000 (aceita texto numérico), data opcional de hoje até 7 dias atrás.
- **Resposta mínima**, `Cache-Control: no-store`, erros sem detalhes. O token nunca é registrado em log.
- **Isolamento**: o dono vem do token, nunca do corpo.
- O proxy (`proxy.ts`) deixa de redirecionar esta rota para o login; o restante do app segue protegido.

### Defesa em profundidade no banco (migration 0011)

- `tokens_api`: `hash` único e com `CHECK` (64 hexadecimais), nome 1 a 40.
- `passos_dia`: passos de 0 a 200.000; origem `atalhos` ou `manual`; uma linha por dia.
- `gasto_estimado` e `projecoes_peso`: `CHECK`s de faixas e `user_id` com cascata.
- `perfis.ritmo_max_pct` entre 0,25 e 1,00; `uso_ia` aceita os tipos `atividade` e `metas`.

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unitários (`npm test`) | **336 passam** (novos: energia e projeção 31, painel 9, IA da fase 6 14, gráficos 7, token 4) |
| Banco, branch `test` (`npm run test:banco`) | **200 passam** (novos: 32, entre API de passos, tokens, energia, meta, explicação e atividade) |
| `tsc`, `eslint` | Sem erros nem avisos |

O que os testes cobrem: fórmulas (Mifflin e Katch) com valores conferidos à mão; adaptativo (peso estável, perdendo, ganhando, poucos dias, dia com menos de 800 kcal, poucas pesagens, resultado fora da fórmula, faixa de incerteza); projeção (desacelera, estabiliza, marcos, peso de equilíbrio); travas (ritmo máximo, nunca abaixo da TMB, IMC, data viável ou não, meta digitada); macros; **IA não inventa número** (explicação com número alheio é descartada); nível inventado recusado; plano × real; tokens (geração, hash, formato do cabeçalho); API de passos (dono certo, último envio vale, data fora do período, token revogado, tipos, tamanho, limite, isolamento) e `CHECK`s do banco.

**Testes reais:**
- Gemini explicou a opção "Moderado" **usando só os números do app** e orientou conversar com o nutricionista.
- Na tela (dev): painel Hoje, meta e plano, atividade, gráficos, criação da chave e `curl` na API (200 com chave válida; 401 sem chave e com chave inventada; 400 com 9.999.999 passos; 405 em GET).

**Defeitos encontrados nos testes e corrigidos:**
1. **Três opções idênticas**: com o gasto perto da taxa basal, "leve", "moderada" e "firme" caíam todas na mesma meta (travadas na TMB). Agora é mostrada uma só, com aviso explicando.
2. **Gráfico de projeção esticava por 104 semanas** sem necessidade; o horizonte agora vai até a meta (com folga) ou 26 semanas.
3. **Peso de equilíbrio**: quando o déficit é pequeno a simulação nem chegava a estabilizar em 2 anos; agora o peso em que o gasto iguala o consumo é calculado diretamente.
4. A data mínima do peso desejado era fixada na carga do módulo (ficaria velha em servidor de longa duração); passou a ser calculada a cada chamada.

## 3. `npm audit`

Nenhum pacote novo. Igual às fases anteriores.

| | Moderadas | Altas |
|---|---|---|
| tudo | 4 | 5 |
| `--omit=dev` | 4 | 0 |

## 4. Segredos e código provisório

Busca por chaves do Google, URLs de banco com senha, chaves privadas e tokens `kly_…` nos arquivos versionados: nada encontrado. O token em claro só existe na resposta da criação (uma vez); os logs da API registram só o contexto e o tipo do erro.

## 5. Regras não cumpridas ou parciais

1. **O gasto é uma estimativa e pode estar errado.** Mitigações: faixa de incerteza visível, explicação do método, adaptativo só com dados suficientes e recusado quando destoa da fórmula, e sempre o aviso "estimativa". **Risco residual:** quem registra só parte da comida terá gasto adaptativo subestimado (o app avisa, mas não consegue saber).
2. **Meta digitada à mão** pode passar das travas: o app **avisa** e não bloqueia, porque pode ter sido combinada com o nutricionista (decisão do `CLAUDE.md`). Já as **sugestões** nunca passam delas.
3. **Referências usadas** (1% do peso por semana, 7.700 kcal por kg, fatores de atividade, proteína em g/kg, IMC 18,5) são aproximações comuns da literatura, não uma prescrição individual. O texto da tela diz para conversar com um profissional, principalmente com medicação ou condição de saúde.
4. **Passo a passo do Atalhos não foi conferido num iPhone**: os nomes das ações mudam entre versões do iOS. A tela avisa isso. A API foi testada com `curl`.
5. **A chave de passos é uma senha**: quem a tiver envia passos para a conta (só isso; não lê nada). Pode ser revogada na hora.
6. **Plano gratuito do Google**: o diagnóstico de atividade envia o texto digitado ao Google, com a prévia exata e o aceite da IA já existentes.

## 6. Como testar no iPhone (depois do deploy)

1. **Ajustes → Nível de atividade**: descreva a sua semana e veja a sugestão da IA; confirme ou escolha outro.
2. **Ajustes → Perfil**: confira sexo, nascimento e altura. Registre o peso em **Progresso**.
3. **Progresso → Meta e plano**: informe o peso desejado (e a data, se quiser). Veja o gasto estimado, as opções e toque em "Explicar com a IA". "Usar como minha meta" grava calorias e macros.
4. **Hoje**: confira calorias × meta, o que a meta significa para o peso e os passos.
5. **Progresso**: troque o período dos gráficos (4 semanas, 3 meses, tudo).
6. **Ajustes → Passos do iPhone**: crie a chave, copie e monte a automação no Atalhos. **Me diga se algum nome de botão for diferente.** Depois confira os passos em Hoje.
7. Teste uma meta digitada à mão abaixo da sua taxa basal em **Ajustes → Metas**: deve aparecer o aviso.

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** aplicar a migration 0011 e fazer o deploy (migration antes do push).
- Conferir o passo a passo do Atalhos no aparelho (e a câmera do código de barras da Fase 4).
- Próxima do SPEC: Fase 7 (registro por foto, receitas e relatório semanal).
- Antigas: importar o backup do "Meu Treino"; e-mail próprio (SMTP) no Neon Auth; licenças do IBGE e do Open Food Facts antes de vender.
