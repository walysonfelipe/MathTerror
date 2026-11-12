import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // caminhos relativos: o jogo funciona em qualquer pasta do site
  base: './',
  // a Cloudflare (wrangler deploy) adiciona o plugin dela aqui automaticamente
  plugins: [],
  build: {
    target: 'es2022', // permite top-level await
    rollupOptions: {
      input: {
        main: page('./index.html'), // Trilha Sombria (corrida lateral 2.5D)
      },
    },
  },
});
