// ===== QUIZ DATA =====
export const QUIZ = [
  // Pergunta em TEXTO + opções em IMAGEM
  {
    questionText: " Considere a funcao f (x) = 2x - 1. Qual dos gráficos abaixo corresponde a f?",
    options: [
      { img: "assets/images/quiz/resp1n.png",  alt: "Porta rangendo",     label: "a" },
      { img: "assets/images/quiz/resp1s.png",  alt: "Porta trancada",     label: "b" },
      { img: "assets/images/quiz/resp1_2n.png",alt: "Porta recém-pintada",label: "c" },
      { img: "assets/images/quiz/resp1_3n.png",alt: "Porta sem maçaneta", label: "d" }
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
];

export const WRONG_IMAGES = ["assets/images/horror.png"];