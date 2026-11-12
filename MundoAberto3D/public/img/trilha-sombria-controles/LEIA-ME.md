# Trilha Sombria — controles para celular

18 artes individuais, com fundo transparente, em PNG e WebP sem perdas.
As pastas `png/` e `webp/` possuem os mesmos nomes; escolha um formato.
Os arquivos já estão exportados em 3x. Defina no jogo as medidas da coluna “Na tela”.

| Ação | Arquivo sem extensão | Na tela | Exportação |
| --- | --- | --- | --- |
| Andar para a esquerda (normal) | `andar-esquerda-normal` | 76 × 76 px | 228 × 228 px |
| Andar para a esquerda (pressionado) | `andar-esquerda-pressionado` | 76 × 76 px | 228 × 228 px |
| Andar para a direita (normal) | `andar-direita-normal` | 76 × 76 px | 228 × 228 px |
| Andar para a direita (pressionado) | `andar-direita-pressionado` | 76 × 76 px | 228 × 228 px |
| Pular (normal) | `pular-normal` | 92 × 92 px | 276 × 276 px |
| Pular (pressionado) | `pular-pressionado` | 92 × 92 px | 276 × 276 px |
| Bola de fogo (normal) | `bola-de-fogo-normal` | 76 × 76 px | 228 × 228 px |
| Bola de fogo (pressionado) | `bola-de-fogo-pressionado` | 76 × 76 px | 228 × 228 px |
| Bola de fogo (sem-carga) | `bola-de-fogo-sem-carga` | 76 × 76 px | 228 × 228 px |
| Correr ao andar (ligado) | `correr-ligado` | 56 × 56 px | 168 × 168 px |
| Correr ao andar (desligado) | `correr-desligado` | 56 × 56 px | 168 × 168 px |
| Usar / examinar / esconder (normal) | `interagir-normal` | 76 × 76 px | 228 × 228 px |
| Usar / examinar / esconder (pressionado) | `interagir-pressionado` | 76 × 76 px | 228 × 228 px |
| Olhar o quadro (normal) | `olhar-quadro` | 24 × 24 px | 72 × 72 px |
| Sair do quadro / voltar (normal) | `sair-quadro` | 24 × 24 px | 72 × 72 px |
| Entrar em tela cheia (entrar) | `tela-cheia-entrar` | 38 × 38 px | 114 × 114 px |
| Sair da tela cheia (sair) | `tela-cheia-sair` | 38 × 38 px | 114 × 114 px |
| Fechar janela (normal) | `fechar-janela` | 34 × 34 px | 102 × 102 px |

## Como usar

- PNG e WebP possuem transparência real fora do botão; o centro dos controles redondos é escuro para preservar a leitura sobre o jogo.
- As artes pressionadas mudam a iluminação. A animação de afundar continua sendo feita pelo jogo; as imagens não deslocam o botão intencionalmente.
- Se preferir usar só a animação atual, mantenha a arte normal ao pressionar.
- `bola-de-fogo-sem-carga` e `correr-desligado` usam símbolo riscado e cores apagadas.
- `olhar-quadro` e `sair-quadro` são somente os ícones. Acrescente “olhar o quadro” e “voltar” no próprio jogo.
- `tela-cheia-entrar`, `tela-cheia-sair` e `fechar-janela` são as alternativas aos SVG/CSS existentes. O jogo controla a disponibilidade de tela cheia por navegador.
- Gestos na tela e teclado numérico não exigem artes adicionais.
- Não estique a imagem de forma diferente na horizontal e na vertical.
- `manifest.json` contém a relação entre ações, estados, caminhos e medidas.
- `previsualizacao.png` é uma folha de consulta; as imagens para integração ficam nas pastas indicadas.

## Exemplo de tamanho

Para a seta esquerda, use o arquivo `png/andar-esquerda-normal.png` com 76 × 76 pixels CSS.
Para pular, use `png/pular-normal.png` com 92 × 92 pixels CSS.
Para olhar o quadro, use `png/olhar-quadro.png` com 24 × 24 pixels CSS.

As artes foram criadas por geração de imagem e exportadas nos tamanhos solicitados.

