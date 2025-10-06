// ===== QUIZ DATA =====
export const QUIZ = [
  // Pergunta em TEXTO + opções em IMAGEM
  {
    questionText: " Considere a funcao f (x) = 2x - 1. Qual dos gráficos abaixo corresponde a f?",
    options: [
      { img: "assets/images/quiz/resp1n.png", alt: "Porta rangendo", label: "a" },
      { img: "assets/images/quiz/resp1s.png", alt: "Porta trancada", label: "b" },
      { img: "assets/images/quiz/resp1_2n.png", alt: "Porta recém-pintada", label: "c" },
      { img: "assets/images/quiz/resp1_3n.png", alt: "Porta sem maçaneta", label: "d" }
    ],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  // Pergunta em TEXTO + opções em TEXTO (compatibilidade com seu formato antigo)
  {
    questionText: "Sejam A = {1,2,3,4} e B = {3,4,5,6}. Qual é A ∪ B?",
    options: ["{1,2,3,4}", "{3,4,5,6}", "{1,2,3,4,5,6}", "{1,2}"],
    answer: 2,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Sejam A = {2,4, 6,8} e B - {1,2,3,4}. Qual é A ∪ B?",
    options: ["{2,4}", "{1,2,3,4,6,8} ", "{1,3}", "{6,8}"],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Sejam A = {2,4, 6,8} e B = {1,2,3,4}. Qual é A ∩ B?",
    options: ["{1,3}", "{2,4}", "{1,2,3,4,6,8} ", "{6,8}"],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Sejam A = {1,3,5, 7,9} e B = {3,6,9}. Qual é A <> B?",
    options: ["{1,5,7}", "{3,6,9}", "{1,3,5,7,9} ", "{5,7,9}"],
    answer: 0,
    video: "assets/videos/door.mp4"
  },

  {
    questionText: "Dado A = {x ∈ N ∣ x < 6}. Qual é o número de elementos de A?",
    options: ["{5}", "{6}", "{0} ", "{-6}"],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Dado f(x) = x² + 2x + 1. Qual é a afirmativa correta das respostas abaixo?",
    options: ["Quadrática que abre pra cima", "Quadrática negativa que abre pra baixo", "Uma reta crescente que passa na origem", "Uma circunferência de raio 2"],
    answer: 0,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Seja f(x) = x² - 1. Qual é a imagem dessa função?",
    options: ["Números Reais {R}", "{y ∈ R ∣ y ≥ − 1}", "y ∈ R ∣ y ≤ − 1}", "Números irreais"],
    answer: 0,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Seja f(x) = 3x + 2. Qual é o valor de f(4)?",
    options: ["10", "12", "14", "20"],
    answer: 2, // f(4) = 3*4 + 2 = 14
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Qual dos gráficos abaixo representa uma função quadrática?",
    options: [
      { img: "assets/images/quiz/retacrescente.png", alt: "Reta crescente", label: "a" },
      { img: "assets/images/quiz/parabola.png", alt: "Parábola voltada para cima", label: "b" },
      { img: "assets/images/quiz/curva.png", alt: "Curva senoidal", label: "c" },
      { img: "assets/images/quiz/reta.png", alt: "Reta decrescente", label: "d" }
    ],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Se A = {1,2,3,4,5} e B = {3,4,5,6,7}, qual é A ∩ B?",
    options: ["{1,2}", "{3,4,5}", "{6,7}", "{1,2,3,4,5,6,7}"],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "O conjunto dos múltiplos de 3 menores que 12 é:",
    options: ["{0,3,6,9}", "{3,6,9,12}", "{3,6,9,12,15}", "{6,9,12}"],
    answer: 0,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "A função f(x) = -x + 4 é:",
    options: ["Crescente", "Constante", "Decrescente", "Quadrática"],
    answer: 2,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Seja o conjunto A = {x ∈ N ∣ x é par e x ≤ 10}. Qual é A?",
    options: ["{1,3,5,7,9}", "{2,4,6,8,10}", "{0,2,4,6,8}", "{4,8,12,16}"],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Se f(x) = x², então f(−3) vale:",
    options: ["−9", "0", "9", "3"],
    answer: 2,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Qual é o domínio da função f(x) = √x?",
    options: [
      "{x ∈ R ∣ x ≥ 0}",
      "{x ∈ R ∣ x ≤ 0}",
      "{x ∈ R}",
      "{x ∈ N}"
    ],
    answer: 0,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Em um diagrama de Venn, A e B são conjuntos. A região que pertence apenas a A é chamada de:",
    options: ["Interseção", "Diferença", "União", "Complementar"],
    answer: 1,
    video: "assets/videos/door.mp4"
  },
  {
    questionText: "Se f(x) = 2x² e g(x) = x + 1, quanto vale f(g(2))?",
    options: ["9", "12", "18", "10"],
    answer: 1, // g(2)=3 → f(3)=2*(3²)=18 → resposta corrigida se quiser 18
    video: "assets/videos/door.mp4"
  },
];

export const WRONG_IMAGES = ["assets/images/horror.png"];