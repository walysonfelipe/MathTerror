# MathTerror — Trilha Sombria

Jogo de terror e matemática em 2.5D: corra pela trilha, resolva as contas dos mortos e não deixe a lanterna apagar.

O jogo fica em [`MundoAberto3D/`](MundoAberto3D/).

```bash
cd MundoAberto3D
npm install
npm run dev     # desenvolvimento
npm run build   # gera dist/
```

## Publicação (Cloudflare)

O deploy usa `MundoAberto3D/wrangler.jsonc`: compila com o Vite e publica `MundoAberto3D/dist/`.
No painel da Cloudflare, o **diretório raiz** do projeto deve ser `MundoAberto3D`.

## Jogo 2D antigo

O MathTerror 2D (corrida com o boss, painel e servidor de estatísticas) foi retirado por enquanto
e está guardado no branch `jogo-2d`.
