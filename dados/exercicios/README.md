# Free Exercise DB – catálogo de exercícios

- **Fonte:** https://github.com/yuhonas/free-exercise-db (arquivo `dist/exercises.json`).
- **Licença:** The Unlicense (domínio público). Texto em `LICENSE.md`. Uso comercial permitido.
- **Arquivo:** `free-exercise-db.json` — 876 exercícios, nomes em inglês. SHA-256: `5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf` (conferido pelo script).
- **Fotos:** cada exercício tem 2 imagens (posição inicial e final) em `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<id>/0.jpg` e `.../1.jpg`. O app não guarda as imagens: só o id (validado por `^[A-Za-z0-9_-]{1,120}$`).
- **Uso no FuelLift:** tabela `catalogo_exercicios` (só leitura para o app). Serve para escolher a foto de um exercício e para ligar os nomes sugeridos pela IA a um exercício do catálogo.

Importação: `npm run exercicios:importar -- --alvo dev|test|producao [--confirmar]`.
