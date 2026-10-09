# Dados de desempenho (especificação)

Este documento descreve os dados que o MathTerror vai registrar de cada partida. A ideia é fixar o formato antes de escrever o servidor e o dashboard.

## Princípios

- **Anônimo:** cada partida gera um `partidaId` próprio, aleatório (UUID). Não há nome, apelido, e-mail, IP nem identificador do aparelho. Duas partidas da mesma pessoa não têm como ser ligadas.
- **Uma partida = um registro.** O jogo monta o registro na memória durante a partida e envia tudo de uma vez quando ela termina. Nada é enviado durante a corrida.
- **Armazenamento:** arquivo `JSONL` no servidor, uma partida por linha.
- **Tempos:** início e fim em data/hora ISO (`2026-10-08T14:32:05.120Z`). Dentro da partida, os momentos são **segundos desde o início** (`emSeg`), o que facilita comparar partidas.
- **Versão:** todo registro carrega `versaoEsquema`. Se um campo mudar no futuro, o dashboard sabe tratar registros antigos.

---

## 1. `Partida` (o registro salvo)

| Campo | Tipo | Descrição |
|---|---|---|
| `versaoEsquema` | número | Começa em `1`. |
| `partidaId` | texto (UUID) | Gerado ao apertar **Iniciar** ou **Tentar novamente**. |
| `iniciadaEm` | data/hora ISO | Momento em que a partida começou. |
| `terminadaEm` | data/hora ISO | Momento em que a partida terminou ou foi abandonada. |
| `duracaoSeg` | número | Tempo total da partida. |
| `pausadaSeg` | número | Tempo com o jogo congelado (celular em pé, popup aberto) ou com a aba escondida. Tempo jogado = `duracaoSeg − pausadaSeg`. |
| `dispositivo` | `Dispositivo` | Tipo de tela e forma de controle. |
| `resultado` | `Resultado` | Como e onde a partida acabou. |
| `resumo` | `Resumo` | Totais prontos para o dashboard. |
| `checkpoints` | `Checkpoint[]` | Um item por checkpoint alcançado, em ordem. |
| `lutas` | `Luta[]` | Uma por luta contra o boss. |
| `quedas` | `Queda[]` | Uma por queda na lava. |

### `Dispositivo`

| Campo | Tipo | Valores |
|---|---|---|
| `tipo` | texto | `celular` · `desktop` |
| `controle` | texto | `teclado` (inclui mouse) · `toque` · `gamepad` · `misto` (mais de um durante a partida) |
| `larguraTela` / `alturaTela` | número | Em pixels CSS, no início da partida. |

### `Resultado`

| Campo | Tipo | Descrição |
|---|---|---|
| `motivoFim` | `MotivoFim` | Veja a tabela abaixo. |
| `checkpointsAlcancados` | número | Quantos checkpoints a coruja alcançou. Define "quem chegou mais longe". |
| `checkpointsSuperados` | número | Quantos ela passou (acertando a pergunta ou vencendo a luta). |
| `nivelMaximo` | número | Maior nível de conta visto (`0`, `1` ou `2`). |
| `pontuacao` | número | O placar mostrado na tela de fim. |
| `vidasRestantes` | número | `0` a `3`. |
| `ondeTerminou` | `Fase` | O que a coruja fazia no fim. |

**`MotivoFim`**

| Valor | Quando acontece |
|---|---|
| `lava` | Perdeu a última vida caindo na lava. |
| `capturado` | O boss pegou a coruja (animação de captura). |
| `luta_perdida` | Perdeu a luta contra o boss (menos de 2 acertos ou ficou sem vidas). |
| `abandono_esc` | Apertou `Esc` durante a partida. |
| `abandono_aba` | Fechou ou recarregou a aba durante a partida. |

**`Fase`**: `corrida` · `checkpoint` · `luta`

### `Resumo`

Esses totais podem ser recalculados a partir das listas, mas ficam prontos no registro para o dashboard não precisar refazer as contas.

| Campo | Tipo | Descrição |
|---|---|---|
| `perguntasCheckpoint` | número | Perguntas de checkpoint mostradas. |
| `tentativas` | número | Total de respostas dadas em checkpoints. |
| `acertos` | número | Checkpoints respondidos corretamente. |
| `acertosPrimeiraTentativa` | número | Acertos sem nenhum erro antes. É o melhor indicador de domínio. |
| `erros` | número | Respostas erradas em checkpoints. |
| `tempoMedioRespostaSeg` | número | Média do tempo até a primeira resposta em cada checkpoint. |
| `quedasLava` | número | |
| `lutas` | número | |
| `lutasVencidas` | número | |

---

## 2. `Checkpoint`

| Campo | Tipo | Descrição |
|---|---|---|
| `numero` | número | 1, 2, 3… |
| `nivel` | número | `0`, `1` ou `2` (sobe a cada 5 checkpoints). |
| `chegouEmSeg` | número | Momento em que a coruja chegou ao checkpoint. |
| `pergunta` | `Pergunta` | A conta mostrada. |
| `tentativas` | `Tentativa[]` | De 0 a 3 respostas. |
| `desfecho` | texto | `acertou` · `tres_erros` · `tempo_esgotado` · `abandono` |
| `duracaoSeg` | número | Da chegada ao desfecho. |

### `Pergunta`

| Campo | Tipo | Descrição |
|---|---|---|
| `tipo` | `TipoConta` | `adicao` · `subtracao` · `multiplicacao` · `divisao` · `tabuada` |
| `formato` | texto | `resultado` (`a × b = ?`) ou `fator_oculto` (`7 × ? = 56`, só na tabuada) |
| `texto` | texto | Exatamente como apareceu: `"Quanto é 83 − 29?"` |
| `a`, `b` | número | Os operandos (na divisão, `a ÷ b`). |
| `respostaCorreta` | número | |
| `exigeVaiUm` | sim/não | Adição em que a soma das unidades passa de 9. |
| `exigeEmprestimo` | sim/não | Subtração em que a unidade de cima é menor que a de baixo. |
| `alternativas` | `Alternativa[]` | As 4 opções, na ordem em que apareceram na tela. |

### `Alternativa`

| Campo | Tipo | Descrição |
|---|---|---|
| `valor` | número | |
| `correta` | sim/não | |
| `tipoErro` | `TipoErro` ou `null` | Qual erro essa alternativa representa (`null` na correta). |

### `Tentativa`

| Campo | Tipo | Descrição |
|---|---|---|
| `numero` | número | 1ª, 2ª ou 3ª tentativa na mesma pergunta. |
| `valorEscolhido` | número | |
| `correta` | sim/não | |
| `tipoErro` | `TipoErro` ou `null` | Copiado da alternativa escolhida. |
| `tempoRespostaSeg` | número | Desde que a pergunta apareceu (1ª tentativa) ou desde a tentativa anterior. |
| `ameacaBoss` | número 0–1 | Quão perto o boss estava no momento da resposta. Separa erro por pressa de erro sem pressa. |

---

## 3. `TipoErro`: o que a alternativa errada revela

O jogo já gera as alternativas erradas a partir de erros comuns (`js/runner-quiz.js`). Basta guardar de qual regra cada alternativa veio.

| Conta | Alternativa gerada | `tipoErro` | O que indica |
|---|---|---|---|
| Adição | resposta − 10 | `esqueceu_vai_um` | Não somou a dezena que "subiu". |
| Adição | resposta + 10 | `dezena_a_mais` | Somou uma dezena a mais. |
| Subtração | menor dígito do maior em cada casa | `emprestimo_invertido` | Não sabe fazer o empréstimo e inverte a conta da unidade. |
| Subtração | resposta ± 10 | `erro_na_dezena` | Errou a dezena (emprestou sem descontar ou o contrário). |
| Multiplicação / Tabuada | resposta ± `a` | `linha_vizinha` | Multiplicou por `b ± 1` (pegou a linha de cima ou de baixo da tabuada). |
| Multiplicação / Tabuada | resposta ± `b` | `tabuada_vizinha` | Usou a tabuada de `a ± 1`. |
| Multiplicação | resposta ± 10 | `erro_na_dezena` | Errou a dezena do produto. |
| Divisão | o próprio divisor `b` | `respondeu_divisor` | Confundiu o divisor com o quociente. |
| Qualquer | resposta ± 1 ou ± 2 | `erro_por_pouco` | Conta quase certa: deslize ou contagem nos dedos. |
| Qualquer | completada por `pickWrongOptions` | `proximo_aleatorio` | Preenchimento, sem diagnóstico. |

Quando um mesmo valor se encaixa em duas regras (ex.: `a = 10` faz `± a` e `± 10` coincidirem), vale a **primeira regra da lista de candidatos** da conta. Isso precisa ser documentado no código para o dashboard não tirar conclusão errada.

---

## 4. `Luta`

| Campo | Tipo | Descrição |
|---|---|---|
| `checkpointNumero` | número ou `null` | Checkpoint onde começou; `null` quando começou na corrida. |
| `origem` | texto | `tres_erros` · `tempo_esgotado` · `corrida_lenta` (gamepad parado e boss alcançou) |
| `comecouEmSeg` | número | |
| `rodadas` | `RodadaLuta[]` | Até 4 (uma de cada operação). |
| `acertos` | número | |
| `venceu` | sim/não | Precisa de pelo menos 2 acertos e ainda ter vida. |
| `vidasPerdidas` | número | |

### `RodadaLuta`

| Campo | Tipo | Descrição |
|---|---|---|
| `tipo` | `TipoConta` | Sem `tabuada`. |
| `texto` | texto | `"12 × 7 = ?"` |
| `respostaCorreta` | número | |
| `valorEscolhido` | número | |
| `correta` | sim/não | |
| `tempoRespostaSeg` | número | |

> As alternativas erradas da luta são aleatórias (resposta ± 1 a 5). Por isso a luta **não tem `tipoErro`**: ela mede velocidade e acerto sob pressão, não o tipo de erro.

---

## 5. `Queda`

| Campo | Tipo | Descrição |
|---|---|---|
| `trecho` | número | Número do checkpoint para o qual a coruja corria (1 = antes do primeiro). |
| `emSeg` | número | |
| `vidasRestantes` | número | Depois da queda. |

> Quedas medem **habilidade motora**, não matemática. O dashboard deve mostrá-las separadas dos erros de conta.

---

## 6. Exemplo de registro (resumido)

```json
{
  "versaoEsquema": 1,
  "partidaId": "3f2b9c1e-8a4d-4f7a-9b1e-2c5d6e7f8a90",
  "iniciadaEm": "2026-10-08T14:32:05.120Z",
  "terminadaEm": "2026-10-08T14:36:41.870Z",
  "duracaoSeg": 276.7,
  "pausadaSeg": 0,
  "dispositivo": { "tipo": "desktop", "controle": "teclado", "larguraTela": 1440, "alturaTela": 900 },
  "resultado": {
    "motivoFim": "luta_perdida", "checkpointsAlcancados": 7, "checkpointsSuperados": 6,
    "nivelMaximo": 1, "pontuacao": 8, "vidasRestantes": 0, "ondeTerminou": "luta"
  },
  "resumo": {
    "perguntasCheckpoint": 7, "tentativas": 10, "acertos": 6, "acertosPrimeiraTentativa": 4,
    "erros": 4, "tempoMedioRespostaSeg": 6.3, "quedasLava": 1, "lutas": 1, "lutasVencidas": 0
  },
  "checkpoints": [
    {
      "numero": 6, "nivel": 1, "chegouEmSeg": 182.4, "desfecho": "acertou", "duracaoSeg": 11.2,
      "pergunta": {
        "tipo": "subtracao", "formato": "resultado", "texto": "Quanto é 63 − 28?",
        "a": 63, "b": 28, "respostaCorreta": 35, "exigeVaiUm": false, "exigeEmprestimo": true,
        "alternativas": [
          { "valor": 45, "correta": false, "tipoErro": "emprestimo_invertido" },
          { "valor": 35, "correta": true,  "tipoErro": null },
          { "valor": 36, "correta": false, "tipoErro": "erro_por_pouco" },
          { "valor": 25, "correta": false, "tipoErro": "erro_na_dezena" }
        ]
      },
      "tentativas": [
        { "numero": 1, "valorEscolhido": 45, "correta": false, "tipoErro": "emprestimo_invertido", "tempoRespostaSeg": 7.9, "ameacaBoss": 0.26 },
        { "numero": 2, "valorEscolhido": 35, "correta": true,  "tipoErro": null, "tempoRespostaSeg": 3.1, "ameacaBoss": 0.78 }
      ]
    }
  ],
  "lutas": [],
  "quedas": [{ "trecho": 3, "emSeg": 71.5, "vidasRestantes": 2 }]
}
```

---

## 7. Perguntas do dashboard → campos usados

| Pergunta | Como responder |
|---|---|
| Quantas partidas por dia / horário? | `iniciadaEm` |
| Quanto tempo as pessoas jogam? | `duracaoSeg − pausadaSeg` |
| Onde as pessoas perdem? | `resultado.motivoFim` + `resultado.checkpointsAlcancados` (curva de "sobrevivência" por checkpoint) |
| Qual partida chegou mais longe? | Ordenar por `checkpointsAlcancados`, desempate por `pontuacao` e menor duração |
| Quais tipos de conta fazem errar? | `checkpoints[].pergunta.tipo` × `nivel` × taxa de `acertosPrimeiraTentativa` |
| Qual erro é mais comum? | Contagem de `tentativas[].tipoErro` por `tipo` de conta |
| "Vai um" e empréstimo são o problema? | Comparar acerto com `exigeVaiUm` / `exigeEmprestimo` = sim e não |
| A pressa causa erro? | Acerto da 1ª tentativa por faixa de `ameacaBoss` e de `tempoRespostaSeg` |
| Dificuldade é de conta ou de reflexo? | `quedas` × erros de checkpoint |
| Quantos desistem? | `motivoFim` = `abandono_esc` / `abandono_aba` |
| O controle muda o desempenho? | `dispositivo.controle` × `checkpointsAlcancados` |

---

## 8. Fica de fora (de propósito)

- Qualquer dado que identifique a pessoa: nome, apelido, IP, ID do aparelho.
- Posição da coruja, pulos e frames: muito volume e nenhuma pergunta do dashboard usa.
- Questões antigas de conjuntos e funções (`js/quiz-data.js`), que não aparecem mais no jogo.
