import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    target: 'es2022', // permite top-level await
    rollupOptions: {
      input: {
        main: page('./index.html'), // Trilha Sombria (corrida lateral 2.5D)
      },
    },
  },
  // Permite importar o gerador de perguntas e a fonte do jogo 2D (pasta acima)
  server: { fs: { allow: ['..'] } },
});
