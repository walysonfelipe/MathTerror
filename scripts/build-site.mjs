// Monta a pasta publicada na Cloudflare (_site/) só com o que os jogos precisam:
//   /         → MathTerror 2D (arquivos estáticos da raiz)
//   /trilha/  → Trilha Sombria (MundoAberto3D, compilada com o Vite)
// Fica de fora: node_modules, server/, data/, docs/, painel/ e o código-fonte do 3D.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}_site`;
const run = (cmd, cwd) => { console.log(`> ${cmd}`); execSync(cmd, { cwd, stdio: 'inherit' }); };

rmSync(out, { recursive: true, force: true });
mkdirSync(out);

// 1) MathTerror 2D
for (const f of ['index.html', 'script.js', 'style.css', 'manifest.json', 'js', 'assets']) {
  if (existsSync(`${root}${f}`)) cpSync(`${root}${f}`, `${out}/${f}`, { recursive: true });
}

// 2) Trilha Sombria
const game = `${root}MundoAberto3D`;
run(existsSync(`${game}/package-lock.json`) ? 'npm ci --no-audit --no-fund' : 'npm install --no-audit --no-fund', game);
run('npm run build', game);
cpSync(`${game}/dist`, `${out}/trilha`, { recursive: true });

console.log('Site pronto em _site/  (/ = MathTerror 2D, /trilha/ = Trilha Sombria)');
