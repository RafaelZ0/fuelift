# Especificação – Fuelift (app de treino + nutrição)

Documento de referência para o desenvolvimento no Claude Code. Descreve o que o app faz, como os dados se organizam e em que ordem construir. Onde houver "verificar", a informação não foi confirmada e precisa ser checada na fonte oficial antes de implementar.

## 1. Visão geral

Fuelift (fuel + lift: combustível e treino) é um app pessoal de saúde que junta, num lugar só:

- diário alimentar com banco de alimentos brasileiro (estilo Yazio), código de barras e registro por texto/foto com IA;
- cálculo do gasto calórico diário, primeiro por fórmula e depois adaptativo (pelos dados reais de peso e consumo);
- plano de treino de 5 dias com registro de cargas, cronômetro de descanso, faltas e evolução;
- controle de água, peso, massa magra e medidas.

Uso inicial: só o dono (Rafael). Possibilidade futura: vender para outros usuários. Por isso o app já nasce **multiusuário** (autenticação + isolamento de dados por usuário), mesmo com um único usuário no começo.

Formato: **web app instalável (PWA)**, usado principalmente no iPhone via "Adicionar à Tela de Início".

## 2. Stack

- Next.js (App Router) + React + TypeScript + Tailwind
- **Neon** (Postgres serverless, plano gratuito) como banco de dados
- **Neon Auth** (baseado em Better Auth, em beta) para login. Os dados de autenticação ficam no schema `neon_auth` do próprio banco
- Drizzle ORM com o driver serverless do Neon (**verificar** na documentação atual a combinação recomendada)
- Vercel, com deploy automático pelo GitHub
- PWA: manifest + service worker (verificar a forma recomendada para a versão do Next.js usada)
- IA: Google Gemini, plano gratuito, chamado **só pelo servidor**. A chave nunca vai para o navegador.
- Armazenamento de arquivos (fotos de progresso): definir nas fases finais

Ambientes: branch `main` do Neon só para produção. Desenvolvimento local e previews usam um branch separado do Neon (ex.: `dev`), para nunca mexer nos dados reais durante testes.

Segurança: regras obrigatórias em `docs/SEGURANCA.md`.

## 3. Módulos e funcionalidades

### 3.1 Perfil e metas

- Dados: altura, data de nascimento, sexo, nível de atividade, peso atual, massa magra (opcional, da avaliação corporal).
- Metas: calorias, proteína, carboidrato, gordura, água. **As metas de calorias e proteína são definidas manualmente** (combinadas com o nutricionista). O app mostra o gasto estimado como referência, mas nunca define a meta sozinho nem sugere déficits agressivos.
- Histórico das metas (a meta de um dia passado não muda quando a meta atual muda).

### 3.2 Gasto calórico diário

Duas camadas, ambas exibidas como **estimativas**:

1. **Fórmula (início):**
   - Com massa magra: Katch-McArdle, TMB = 370 + 21,6 × massa magra (kg).
   - Sem massa magra: Mifflin-St Jeor (homem: 10 × peso + 6,25 × altura em cm − 5 × idade + 5; mulher: mesma conta com −161 no lugar de +5).
   - Gasto total = TMB × fator de atividade.
2. **Gasto adaptativo (depois de ~14 dias de registro):**
   - Calcular a tendência do peso com média móvel exponencial (as pesagens diárias oscilam com água e sal).
   - Gasto ≈ média de calorias consumidas no período − (variação da tendência de peso em kg × 7.700 ÷ número de dias).
   - O fator de 7.700 kcal por kg é uma aproximação usada na literatura. Deixar como constante configurável.
   - Exigir uma quantidade mínima de dias com registro completo. Sem dados suficientes, mostrar a estimativa por fórmula e explicar o motivo.
   - Recalcular semanalmente e mostrar a faixa de incerteza, não um número exato.
- **Não somar calorias do treino à meta por padrão.** O gasto adaptativo já incorpora a atividade real, e as estimativas de calorias por exercício são imprecisas.

### 3.3 Diário alimentar

- Refeições do dia: café da manhã, almoço, lanche, jantar, ceia (lista editável).
- Busca de alimentos em português, tolerante a acentos e erros de digitação. Fontes: TACO, produtos de código de barras em cache e alimentos criados pelo usuário.
- Porções em gramas e em medidas caseiras (colher de sopa, concha, unidade, fatia, xícara...), com tabela de conversão por alimento.
- Favoritos, refeições salvas, receitas (soma dos ingredientes com rendimento em porções) e copiar refeição/dia anterior.
- Totais do dia: calorias, proteína, carboidrato, gordura e fibra versus metas.
- Cada entrada guarda os nutrientes **calculados no momento do registro** (snapshot), para que correções futuras no banco não alterem o histórico.

### 3.4 Registro por IA (texto e foto)

Princípio central: **a IA interpreta, o banco de dados calcula.**

1. O usuário escreve ("almocei 2 conchas de feijão, arroz e um filé de frango grelhado") ou envia uma foto.
2. O servidor pede ao Gemini uma saída em JSON estruturado: lista de itens com nome, quantidade, unidade, gramas estimadas e nível de confiança.
3. Cada item é casado com o banco de alimentos (busca textual). As calorias vêm do banco, não da IA.
4. A tela mostra os itens com alimento casado, porção e confiança. O usuário confirma, ajusta ou troca **antes de salvar**. Nada é salvo sem confirmação.
5. Itens sem correspondência no banco: o usuário escolhe outro alimento ou cria um novo.

Detalhes:

- Fotos: estimativa de porção por imagem é imprecisa. Mostrar isso na interface e sempre pedir confirmação das gramas.
- Camada de abstração do provedor de IA (uma interface com implementação Gemini), para trocar de provedor ou de plano sem reescrever o app.
- Nome do modelo em variável de ambiente (`GEMINI_MODEL`), porque a lista de modelos gratuitos muda.
- Tratar o erro de limite (HTTP 429 / RESOURCE_EXHAUSTED) com nova tentativa espaçada e mensagem clara ao usuário.
- Registrar o uso diário de IA numa tabela para acompanhar o consumo do limite gratuito.
- **Verificar** na documentação oficial do Gemini: modelos disponíveis no plano gratuito, limites atuais, SDK oficial para Node/TypeScript e como pedir saída em JSON com esquema.
- Aviso na interface: no plano gratuito, os termos do Google permitem usar o conteúdo enviado para melhorar os modelos, inclusive com leitura por revisores humanos.

### 3.5 Código de barras

- Leitura pela câmera do iPhone no navegador. **Verificar** qual biblioteca funciona de forma confiável no Safari do iOS e testar no aparelho.
- Consulta ao Open Food Facts pelo código. Guardar o resultado em cache no banco.
- Produto não encontrado ou incompleto: formulário para cadastrar a partir do rótulo (por porção ou por 100 g).
- Atribuir o Open Food Facts na interface, conforme a licença ODbL.

### 3.6 Água

- Botões rápidos (+200, +300, +500 ml e valor livre), desfazer e meta diária.

### 3.7 Treino

Migrar o plano atual (detalhes completos no backup do app atual e no documento "Plano de Treino – 5 dias"):

- 5 treinos (Dia 1 superiores/empurrar, Dia 2 inferiores/quadríceps, Dia 3 superiores/puxar, Dia 4 inferiores/posterior e glúteo, Dia 5 corpo inteiro + core), cada exercício com séries, faixa de repetições, observações, substitutos e foto.
- Fotos: Free Exercise DB (github.com/yuhonas/free-exercise-db), publicado como domínio público. Guardar a referência da fonte.
- Agenda semanal configurável (dia da semana → treino) e troca do treino em um dia específico.
- Fase de readaptação: 2 séries nas semanas 1 a 3, 3 séries a partir da semana 4 (contadas a partir da data de início, configurável).
- Registro por série: carga, repetições (ou segundos), feito. Exercícios unilaterais e "carga por halter" sinalizados.
- Escolha do exercício feito (principal ou substituto), registrada na sessão.
- Cronômetro de descanso ao marcar uma série (tempo configurável, +15 s, pular, aviso sonoro).
- Dica de progressão: mostrar o que foi feito na última sessão do exercício. Se todas as séries chegaram ao topo da faixa, sugerir subir a carga.
- Treino feito, falta com motivo (trabalho, cansaço, dor ou lesão, doente, imprevisto, outro) e observação.
- Calendário mensal: feito, faltou, planejado, sem registro. Estatísticas: treinos no mês, faltas, sequência atual, motivos mais comuns.
- Evolução por exercício: gráfico da maior carga por sessão e histórico.

### 3.8 Corpo

- Pesagens (idealmente diárias, em jejum), massa magra e cintura.
- Gráfico com o peso bruto e a linha de tendência.
- Fotos de progresso opcionais, em armazenamento privado (serviço a definir).
- Lembrete opcional da aplicação semanal do Ozempic (só um registro de "feito" no dia escolhido; o app não dá orientação sobre a medicação).

### 3.9 Passos

- Um web app não acessa o app Saúde do iPhone.
- Endpoint `POST /api/passos` autenticado por token pessoal (gerado e revogável nas configurações).
- Automação no app Atalhos do iPhone que lê os passos do dia e envia ao endpoint. **Verificar** e documentar o passo a passo testado no aparelho.
- Passos aparecem no painel e ajudam a interpretar o gasto adaptativo (não entram como calorias somadas).

### 3.10 Painel "Hoje"

Primeira tela do app: calorias consumidas × meta, proteína, água, treino do dia (com acesso direto), peso de hoje e gasto estimado.

### 3.11 Relatório semanal (fase final)

- Resumo automático: média de calorias e proteína, dias registrados, treinos feitos e faltas, variação da tendência de peso e gasto adaptativo atualizado.
- Opcional: texto-resumo gerado pelo Gemini a partir desses números, sem inventar dados que não estejam no banco.

### 3.12 Meta de perda de peso e plano personalizado

- O usuário define: peso-meta, data desejada (opcional) e a meta diária de calorias combinada com o nutricionista.
- **Projeção:** simulação semana a semana. Perda semanal ≈ (gasto estimado − consumo médio) × 7 ÷ 7.700. A cada semana simulada, o gasto estimado é recalculado para o peso projetado, porque o gasto cai conforme o peso cai. Uma projeção linear seria otimista demais.
- Resultado: data estimada para atingir a meta, marcos intermediários (a cada 5 kg, editável) e ritmo semanal previsto.
- **Com data desejada:** calcular o déficit diário necessário. Se o ritmo exigido passar de cerca de 1% do peso corporal por semana (referência geral comum, configurável), mostrar um aviso para conversar com o nutricionista. O app não muda a meta sozinho.
- **Plano × real:** recalcular toda semana com o gasto adaptativo e a tendência real do peso. Mostrar se está adiantado, no ritmo ou atrasado em relação à projeção original, e guardar cada versão da projeção.
- Proteção da massa magra: mostrar a média de proteína da semana versus a meta e a evolução da massa magra nas avaliações.

### 3.13 Gráficos

Todos com seletor de período (4 semanas, 3 meses, tudo):

1. **Peso:** pesagens diárias (pontos), tendência (linha), projeção até a meta (tracejada) e linha horizontal do peso-meta.
2. **Consumo × gasto:** barras com as calorias consumidas por dia e linha do gasto estimado. A diferença aparece como déficit ou superávit. Visão semanal com médias.
3. **Déficit acumulado × perda real:** perda esperada pelo déficit registrado (em kg) comparada com a perda real da tendência. Uma diferença grande indica registro incompleto ou gasto mal estimado.
4. **Composição corporal:** peso, massa magra e massa gorda (peso − massa magra) em cada avaliação.
5. **Proteína diária × meta.**
6. **Treino:** carga por exercício (já descrito em 3.7) e treinos por semana.

Biblioteca sugerida: Recharts (**verificar** a compatibilidade com a versão do React usada). Os cálculos dos gráficos ficam em funções puras testadas, separados dos componentes.

### 3.14 Importação do app atual

O app "Meu Treino" (artifact do Claude) exporta um backup JSON no formato:

```
{ "app": "meu-treino", "v": 1, "exported": "...", "data": { "config": {...}, "body": { "entries": [...] }, "days": { "AAAA-MM-DD": {...} } } }
```

Criar uma tela de importação que leia esse arquivo e converta para as tabelas novas (sessões, séries, faltas, água, alimentos registrados manualmente, pesagens). Pedir ao usuário um backup real para confirmar o formato antes de escrever o importador.

## 4. Banco de dados (proposta inicial)

Toda tabela de dados pessoais tem `user_id` (o id do usuário no Neon Auth, tipo texto). O acesso aos dados passa sempre por uma camada de dados no servidor que recebe o `user_id` da sessão e filtra todas as consultas por ele (detalhes em `docs/SEGURANCA.md`). Isso prepara o app para outros usuários.

- `perfis` – dados do usuário e preferências.
- `metas` – metas com data de início de vigência.
- `alimentos` – fonte (`taco` | `off` | `usuario`), nome, marca, código de barras, nutrientes por 100 g (kcal, proteína, carboidrato, gordura, fibra, sódio), `user_id` nulo para alimentos públicos.
- `medidas_caseiras` – alimento, nome da medida, gramas.
- `registros_alimentares` – data, refeição, alimento, gramas, nutrientes em snapshot, origem (`manual` | `ia_texto` | `ia_foto` | `codigo_barras`).
- `refeicoes_salvas`, `receitas`, `receita_itens`.
- `agua` – data, ml, horário.
- `pesagens` – data, peso, massa magra, cintura.
- `planos_treino`, `treinos` (Dia 1 a 5), `exercicios`, `treino_exercicios` (ordem, séries, faixa, substitutos).
- `sessoes_treino` – data, treino, status (`feito` | `faltou`), motivo, observação.
- `series` – sessão, exercício, variação escolhida, número, carga, repetições, feito.
- `passos_dia` – data, passos, origem.
- `aplicacoes` – data (lembrete do Ozempic).
- `gasto_estimado` – data de cálculo, método, valor, faixa de incerteza, dias usados.
- `uso_ia` – data, tipo, quantidade de chamadas.
- `tokens_api` – token pessoal (guardar só o hash) para o endpoint de passos.

Busca de alimentos em português: **verificar** as extensões de Postgres disponíveis no Neon (por exemplo, para ignorar acentos e buscar por similaridade) antes de definir os índices.

## 5. Dados de alimentos

- **TACO (NEPA/UNICAMP):** obter o arquivo oficial no site do NEPA/UNICAMP (**verificar** formato e edição mais recente). Escrever um script de importação (seed) com validação dos valores. Não usar cópias de sites de terceiros sem checar origem e licença.
- **Open Food Facts:** consulta sob demanda por código de barras, com cache. Enviar um User-Agent identificando o app, como o projeto pede.
- **Alimentos do usuário:** cadastro manual a partir de rótulos.

## 6. Ordem de construção (fases)

1. Base: projeto, autenticação, camada de dados segura, perfil, metas, layout mobile e PWA instalável.
2. Banco de alimentos: importação da TACO, busca, diário manual, medidas caseiras, favoritos.
3. Treino completo (seção 3.7), água e corpo. Importação do backup do app atual.
4. Código de barras com Open Food Facts.
5. Registro por IA com texto.
6. Gasto calórico (fórmula e adaptativo), meta de peso com projeção, gráficos de peso × gasto. Endpoint e automação de passos.
7. Registro por IA com foto, receitas e relatório semanal.

Cada fase termina com o app funcionando, publicado no Vercel e testado no iPhone.

## 7. Antes de vender (não fazer agora, mas não bloquear)

- **Gemini:** **verificar** se o plano gratuito permite uso comercial (há fontes dizendo que não) e a questão de privacidade. Com outros usuários, migrar para um plano pago ou outro provedor. A abstração da seção 3.4 existe para isso.
- **Open Food Facts:** licença ODbL, com atribuição e possível obrigação de compartilhar bases derivadas. **Verificar** as regras para uso comercial.
- **TACO:** **verificar** os termos de uso para fins comerciais.
- **LGPD:** dados de saúde são dados pessoais sensíveis. Será preciso política de privacidade, consentimento, exclusão de conta e exportação de dados.
- Aviso permanente de que o app não substitui nutricionista, médico ou educador físico.
