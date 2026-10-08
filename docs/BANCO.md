# Banco, autenticação e variáveis de ambiente

## 1. Branches do Neon

Projeto Neon: `fuelift` (`gentle-scene-00627818`, região aws-us-east-2). No Neon, o branch principal se chama **`production`**; neste guia, "main" e "production" são o mesmo branch.

| Branch | Uso | Quem usa |
|---|---|---|
| `main` | Produção (dados reais) | Vercel – Production |
| `dev` | Desenvolvimento e previews | `.env.local` e Vercel – Preview |
| `test` | Testes automáticos (`npm run test:banco`) | `.env.test.local` |

No console do Neon: **Branches → Create branch**. Crie `dev` a partir de `main` e `test` a partir de `dev`, **depois** de criar o papel do app (passo 3), para o papel já existir nos dois.

## 2. Neon Auth (em cada branch: main e dev)

No console, no branch escolhido, abra **Auth**:

1. Ative o Neon Auth.
2. Em **Settings → Auth**, ligue **Sign-up with Email** e **Verify at Sign-up**, no modo **código** (o app tem a tela para digitar o código de 6 números).
3. Copie a **Auth URL**. Ela vai em `NEON_AUTH_BASE_URL`.
4. Em **Domains**, adicione o domínio de produção do Vercel (no branch `main`; hoje: `https://kalyft.vercel.app`, `https://fuellift.vercel.app` e `https://fuelift-ruddy.vercel.app`). No branch `main`, desligue **Allow Localhost** (recomendação do checklist de produção do Neon); no `dev`, deixe ligado.

O app não expõe a API do Neon Auth diretamente (não há rota `/api/auth`). Login, cadastro, código, recuperação de senha e saída passam por Server Actions com limite de tentativas. A recuperação de senha usa o mesmo código de 6 números e, ao trocar a senha, encerra as outras sessões do usuário.

## 3. Papel do app com permissão mínima

O app conecta com um papel que só lê e grava dados. As migrations usam o papel dono (`neondb_owner`).

No **SQL Editor** do Neon, no branch `main`, rode o SQL abaixo. Antes, troque `SENHA_FORTE` por uma senha gerada com:

```
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

```sql
CREATE ROLE fuelift_app LOGIN PASSWORD 'SENHA_FORTE';
GRANT CONNECT ON DATABASE neondb TO fuelift_app;
GRANT USAGE ON SCHEMA public TO fuelift_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fuelift_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fuelift_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

- O `ALTER DEFAULT PRIVILEGES` faz as tabelas criadas pelas próximas migrations já darem acesso ao app.
- O papel do app não tem acesso ao schema `neon_auth` nem pode criar ou apagar tabelas.
- Branches criados depois herdam o papel e a mesma senha. Use uma senha diferente por ambiente com `ALTER ROLE fuelift_app PASSWORD '...'` em cada branch.
- Monte a URL do app copiando a connection string do console (com pooler) e trocando usuário e senha por `fuelift_app` e a senha nova.

## 4. Variáveis

| Variável | `.env.local` (dev) | `.env.test.local` (test) | Vercel Production | Vercel Preview |
|---|---|---|---|---|
| `DATABASE_URL` | `fuelift_app` @ dev, **com** pooler | `fuelift_app` @ test, com pooler | `fuelift_app` @ main, com pooler | `fuelift_app` @ dev, com pooler |
| `DATABASE_URL_MIGRACOES` | `neondb_owner` @ dev, **sem** pooler | `neondb_owner` @ test, sem pooler | **não configurar** | **não configurar** |
| `NEON_AUTH_BASE_URL` | Auth URL do dev | Auth URL do test (opcional) | Auth URL do main | Auth URL do dev |
| `NEON_AUTH_COOKIE_SECRET` | segredo A | qualquer, 32+ | segredo B | segredo C |
| `LIMITES_HMAC_KEY` | chave D | chave E | chave F | chave G |
| `ADMIN_EMAILS` | seu e-mail | — | seu e-mail | seu e-mail |
| `BANCO_DE_TESTE` | — | `sim` | — | — |

- `LIMITES_HMAC_KEY` é a chave do HMAC-SHA256 que esconde e-mail e IP na tabela `limites`. Sem ela (ou com menos de 32 caracteres), login, cadastro e recuperação de senha ficam bloqueados.
- Gere cada segredo com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Use um segredo diferente em cada ambiente.
- Nenhuma variável começa com `NEXT_PUBLIC_`.
- No Vercel, **não** ative a integração do Neon que cria um branch por preview. Os previews devem usar o branch `dev`.

## 5. Migrations

```
npm run db:gerar     # gera o SQL em drizzle/ a partir de lib/db/schema.ts
npm run db:migrar    # aplica no banco de DATABASE_URL_MIGRACOES (.env.local = dev)
```

Para produção, use `npm run db:migrar:producao`, que lê a URL do dono do branch `production` em `.env.main.local` (fora do git). Rode só depois de testar no `dev`. As migrations nunca rodam no build do Vercel.

## 6. Dados oficiais

```
npm run taco:importar -- --alvo dev|test|producao [--confirmar]   # TACO + complementos
npm run ibge:importar -- --alvo dev|test|producao [--confirmar]   # medidas referidas do IBGE
```

Os dois são idempotentes, conferem o SHA-256 do arquivo e gravam tudo numa transação (ou nada). Produção exige `--confirmar` e usa `.env.main.local`.

## 7. Testes

```
npm test             # validação e datas (sem banco)
npm run test:banco   # isolamento entre usuários e CHECKs, no branch test
```
