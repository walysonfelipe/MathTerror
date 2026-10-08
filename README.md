<p align="center">
  <img src="assets/images/logo.webp" alt="MathTerror" width="420" />
</p>

<h3 align="center">🎮 Aprenda matemática… se tiver coragem.</h3>

<p align="center">Jogo educativo de terror para treinar contas: adição, subtração, multiplicação, divisão e tabuada.</p>

---

## Sobre o jogo

**MathTerror** é um jogo de navegador em que uma coruja corre por plataformas suspensas sobre lava enquanto um boss a persegue. A corrida é automática: você pula os buracos, chega aos checkpoints e resolve questões para abrir caminho. Se errar demais ou deixar o tempo acabar, terá de enfrentar o boss em uma luta de contas rápidas.

## Como jogar

1. No menu, selecione **Iniciar Fuga Infernal**. O jogo começa com três vidas.
2. Durante a corrida, pule os buracos para não cair na lava. A cada trecho, a coruja chega a um checkpoint.
3. No checkpoint, escolha uma alternativa para responder à questão. O boss se aproxima enquanto o cronômetro avança.
4. Uma resposta certa faz o boss recuar e permite continuar a corrida. Uma resposta errada acelera a aproximação do boss, mas ainda permite novas tentativas enquanto houver tempo.
5. O terceiro erro no mesmo checkpoint ou o fim do tempo inicia a luta contra o boss. Responda quatro contas, uma de cada operação (+, −, × e ÷); acerte pelo menos duas para sobreviver e continuar. Cada resposta errada nessa luta custa uma vida.
6. Cair na lava também custa uma vida; a coruja reaparece adiante na pista se ainda houver vidas. Se o boss vencer ou as três vidas acabarem, a partida termina. No fim, você pode tentar novamente ou voltar ao menu.

O jogo mostra no placar o total de questões respondidas corretamente. A velocidade da corrida aumenta a cada checkpoint superado.

### Controles

| Ação | Teclado | Celular ou tablet |
|---|---|---|
| Pular durante a corrida | `Espaço`, `↑` ou `W` | Toque na área do jogo |
| Escolher uma alternativa | Teclas `1` a `4` | Toque no botão da alternativa |
| Sair da partida | `Esc` | — |

### Controle (gamepad)

O jogo também funciona com controle no navegador (Xbox, PlayStation ou outro compatível com a Gamepad API). Ao conectar, um aviso aparece no topo da tela e um ícone fica ao lado do botão de som. Se o controle não for detectado, aperte qualquer botão dele com a aba do jogo aberta.

| Momento | Navegar | Confirmar / agir |
|---|---|---|
| Menu inicial | D-pad ou analógico esquerdo entre **Som**, **Tela cheia** e **Iniciar Fuga Infernal** | `A` |
| Corrida | D-pad `→` ou analógico para a direita para correr | `A` para pular |
| Checkpoint e luta | D-pad ou analógico para destacar uma alternativa | `A` para confirmar a alternativa destacada |
| Fim de partida | D-pad ou analógico entre **Tentar novamente** e **Voltar ao menu** | `A` |

Como funciona com o controle:

- **Menu:** o botão **Iniciar** já começa selecionado. O botão escolhido fica destacado, e segurar a direção continua movendo a seleção.
- **Corrida:** com controle, a corrida deixa de ser automática. Quanto mais o analógico vai para a direita, mais rápido a coruja corre. Se você diminuir o ritmo ou parar, o boss começa a se aproximar e, se chegar até a coruja, abre a luta.
- **Checkpoint e luta:** a primeira alternativa já começa destacada. Use o D-pad ou o analógico para mudar a alternativa destacada e aperte **A** para confirmar.
- **Durante a partida:** com o controle conectado, as respostas passam a ser dadas pelo controle, e não por toque, clique ou teclas `1` a `4`.

> **Limitação do navegador:** os navegadores não contam um botão do controle como interação do usuário. Por isso, ativar a **tela cheia** pelo controle pode ser bloqueado. Se acontecer, clique uma vez no botão de tela cheia com o mouse ou toque na tela.

Em celulares, jogue com o aparelho na horizontal. Os botões de som e tela cheia ficam disponíveis na interface. No iPhone, para jogar sem as barras do Safari, adicione o site à Tela de Início e abra-o pelo ícone.

## Conteúdo de matemática

Cada checkpoint gera uma conta nova, então as perguntas não se repetem em ciclo. Os tipos se revezam (todos aparecem antes de algum repetir):

| Tipo | Exemplo no início | Exemplo mais adiante |
|---|---|---|
| Adição | `46 + 9` | `47 + 25` (com "vai um") |
| Subtração | `27 − 6` | `83 − 29` (com empréstimo) |
| Multiplicação | `17 × 5` | `29 × 7` |
| Divisão (sempre exata) | `40 ÷ 5` | `132 ÷ 11` |
| Tabuada | `3 × 4 = ?` | `8 × ? = 72` |

As contas sobem de nível a cada 5 checkpoints, até o terceiro nível. As alternativas erradas imitam erros comuns, como esquecer o "vai um" ou usar a linha vizinha da tabuada. A luta contra o boss continua com contas rápidas de adição, subtração, multiplicação e divisão.

As antigas questões de conjuntos e funções continuam em `js/quiz-data.js`, mas não são mais usadas no jogo.

## Executar localmente

O projeto é estático, sem etapa de instalação ou dependências de build. Como usa módulos JavaScript, abra-o por um servidor HTTP local em vez de abrir `index.html` diretamente:

```bash
python3 -m http.server 8080
```

Depois, acesse <http://localhost:8080> no navegador. Também é possível usar outro servidor estático, como `npx serve .`.

## Tecnologias

- **HTML5** para a estrutura da página.
- **CSS3** para o layout responsivo, efeitos visuais e interface.
- **JavaScript com ES Modules**, sem framework, para a lógica do jogo.
- **Canvas** para renderizar a corrida e as animações dos personagens.

## Estrutura do projeto

```text
MathTerror/
├── index.html              # Página e elementos da interface
├── style.css               # Layout, responsividade e efeitos visuais
├── script.js               # Inicialização do jogo
├── js/
│   ├── dom-elements.js       # Referências aos elementos da página
│   ├── game-state.js         # Troca entre menu e partida (vídeos de fundo)
│   ├── config.js             # Configurações gerais (embaralhar alternativas)
│   ├── utils.js              # Embaralhamento de listas e alternativas
│   ├── audio.js              # Liga, desliga e toca música e efeitos
│   ├── fullscreen.js         # Tela cheia
│   ├── orientation.js        # Aviso de girar o celular e dica do iPhone
│   ├── hud.js                # Moldura de vidas e pontos
│   ├── gamepad-status.js     # Detecção e aviso de controle conectado
│   ├── menu-gamepad.js       # Navegação do menu inicial pelo controle
│   ├── quiz-data.js          # Banco antigo de questões (não usado)
│   ├── runner-mode.js        # Estados e fluxo principal da partida
│   ├── runner-config.js      # Ritmo, tempos, vidas, erros e física
│   ├── runner-assets.js      # Sprites, animações e medidas da coruja e do boss
│   ├── runner-fight-assets.js # Sprites e tempos das cenas de luta
│   ├── runner-animations.js  # Cálculo das poses da coruja
│   ├── runner-physics.js     # Pulo, aterrissagem e queda nos buracos
│   ├── runner-world.js       # Geração das plataformas e portas
│   ├── runner-boss.js        # Movimento e ações do boss (perseguição, salto, captura)
│   ├── runner-fight-path.js  # Palco e trajetos da coruja na luta
│   ├── runner-input.js       # Teclado, toque e controle durante a partida
│   ├── runner-quiz.js        # Geração das contas do checkpoint e da luta
│   ├── runner-renderer.js    # Desenho da cena no canvas
│   ├── runner-ui.js          # Painéis de pergunta, progresso e fim de partida
│   └── runner-audio.js       # Efeitos sonoros da partida
├── assets/
│   ├── audio/              # Música e efeitos sonoros
│   ├── fonts/              # Tipografias
│   ├── images/             # Logo, personagens, interface e imagens das questões
│   └── videos/             # Vídeos de fundo do menu e da partida
└── README.md
```

## Equipe

Projeto acadêmico desenvolvido por alunos de **Análise e Desenvolvimento de Sistemas (ADS)** da **FATEC**, para a disciplina de **Cálculo 1**.

| Membro | GitHub |
|---|---|
| Walyson Felipe | [@walysonfelipe](https://github.com/walysonfelipe) |
| Gabriel Martins | [@orickzs](https://github.com/orickzs) |
| Filipe Rattighieri | [@FilipeRattighieri](https://github.com/FilipeRattighieri) |
| Eduardo Xavier | [@eduduf](https://github.com/eduduf) |
| Gabriel Cardinale | [@Grayved](https://github.com/Grayved) |

---

<p align="center"><sub>Feito com 🩸 e matemática.</sub></p>
