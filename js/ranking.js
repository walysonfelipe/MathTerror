export function showRankingScreen() {
  document.getElementById('rankingScreen')?.remove();
  let scores = [];
  try { scores = JSON.parse(localStorage.getItem('scores') || '[]'); } catch {}
  if (!Array.isArray(scores)) scores = [];
  const overlay = document.createElement('div');
  overlay.id = 'rankingScreen';
  overlay.className = 'modal-backdrop';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'rankingTitle');
  const panel = document.createElement('div');
  panel.className = 'quiz-inner';
  panel.innerHTML = '<span class="eyebrow">OS QUE ENFRENTARAM O MEDO</span><h2 id="rankingTitle" class="modal-title" style="margin-top:12px">Ranking dos sobreviventes</h2><p class="modal-text">Seus melhores resultados neste navegador.</p>';
  if (!scores.length) {
    const empty = document.createElement('p');
    empty.className = 'modal-text';
    empty.textContent = 'O corredor ainda espera seu primeiro sobrevivente. Jogue o modo Sobrevivência para registrar sua pontuação.';
    panel.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'ranking-table';
    table.innerHTML = '<thead><tr><th>Posição</th><th>Jogador</th><th>Acertos</th></tr></thead>';
    const body = document.createElement('tbody');
    scores.sort((a, b) => b.score - a.score).slice(0, 10).forEach((score, index) => {
      const row = document.createElement('tr');
      [String(index + 1).padStart(2, '0'), score.name, score.score].forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.appendChild(body);
    panel.appendChild(table);
  }
  const close = document.createElement('button');
  close.className = 'btn';
  close.textContent = 'Voltar ao início';
  const dismiss = () => {
    overlay.remove();
    document.removeEventListener('keydown', keyboard);
    document.getElementById('rankingBtn').focus();
  };
  const keyboard = event => {
    if (event.key === 'Escape') dismiss();
    if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
  };
  close.onclick = dismiss;
  document.addEventListener('keydown', keyboard);
  panel.appendChild(close);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  close.focus();
}
