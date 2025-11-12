// ===================== RANKING COMPLETO (PÓDIO + TABELA) =====================
export function showRankingScreen() {
  const stored = JSON.parse(localStorage.getItem('scores') || '[]');
  if (stored.length === 0) {
    alert('Nenhuma pontuação registrada ainda.');
    return;
  }

  // Pega top 15
  const topScores = [...stored].sort((a, b) => b.score - a.score).slice(0, 15);

  // Remove ranking antigo
  const old = document.getElementById('rankingScreen');
  if (old) old.remove();

  // Overlay centralizado
  const overlay = document.createElement('div');
  overlay.id = 'rankingScreen';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    zIndex: '99999',
    animation: 'fadeInUp 0.8s ease-out both'
  });

  // Container principal
  const wrap = document.createElement('div');
  wrap.className = 'quiz-inner';
  Object.assign(wrap.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    maxWidth: '720px',
    padding: '32px',
    textAlign: 'center',
  });

  // 🩸 Título principal
  const title = document.createElement('h2');
  title.textContent = '🏆 Ranking dos Sobreviventes';
  Object.assign(title.style, {
    fontFamily: '"Creepster", cursive',
    color: '#ff1a1a',
    fontSize: '2.4rem',
    textShadow: '0 0 22px rgba(255,0,0,0.45)',
    letterSpacing: '1px',
    marginBottom: '-8px',
  });
  wrap.appendChild(title);

  // ===================== PÓDIO (1º, 2º, 3º) =====================
  const podium = document.createElement('div');
  Object.assign(podium.style, {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: '18px',
    width: '100%',
    marginTop: '20px',
  });

  const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // ouro, prata, bronze
  const podiumHeights = [140, 100, 80]; // alturas
  const firstThree = topScores.slice(0, 3);
  const order = [1, 0, 2]; // ordem visual F1 (2º, 1º, 3º)

  order.forEach((pos) => {
    const s = firstThree[pos];
    if (!s) return;

    const column = document.createElement('div');
    Object.assign(column.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      width: '120px',
      textAlign: 'center'
    });

    const name = document.createElement('span');
    name.textContent = s.name;
    Object.assign(name.style, {
      fontSize: '1.1rem',
      fontWeight: '600',
      color: '#fff',
      textShadow: '0 0 10px rgba(255,0,0,0.45)'
    });
    column.appendChild(name);

    const block = document.createElement('div');
    Object.assign(block.style, {
      height: podiumHeights[pos] + 'px',
      width: '100%',
      borderRadius: '8px 8px 0 0',
      background: `linear-gradient(180deg, ${podiumColors[pos]} 0%, #4a0000 95%)`,
      boxShadow: '0 0 20px rgba(255,0,0,0.25)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#000',
      fontSize: '1.3rem',
      fontWeight: 'bold',
      fontFamily: '"Spectral SC", serif',
    });
    block.innerHTML = `${pos + 1}º<br><span style="font-size:1rem;color:#fff;">${s.score} pts</span>`;
    column.appendChild(block);

    podium.appendChild(column);
  });

  wrap.appendChild(podium);

  // ===================== LISTA DO 4º AO 15º =====================
  const tableTitle = document.createElement('h3');
  tableTitle.textContent = '⚔️ Classificação Geral';
  Object.assign(tableTitle.style, {
    fontFamily: '"Creepster", cursive',
    color: '#ffcc00',
    textShadow: '0 0 20px rgba(255,200,0,0.4)',
    marginTop: '18px',
    fontSize: '1.6rem'
  });
  wrap.appendChild(tableTitle);

  const table = document.createElement('table');
  Object.assign(table.style, {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#fff',
    fontFamily: '"Spectral SC", serif',
    background: 'rgba(40,0,0,0.45)',
    border: '1px solid rgba(255,0,0,0.35)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 0 30px rgba(255,0,0,0.15)',
  });

  const others = topScores.slice(3, 15);
  const header = document.createElement('thead');
  header.innerHTML = `
    <tr style="background:rgba(80,0,0,0.65); font-size:1rem;">
      <th style="padding:10px 6px;">Posição</th>
      <th style="text-align:left;">Jogador</th>
      <th style="text-align:right;padding-right:12px;">Pontuação</th>
    </tr>`;
  table.appendChild(header);

  const body = document.createElement('tbody');
  others.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;padding:6px 0;">${i + 4}º</td>
      <td style="text-align:left;padding-left:8px;">${s.name}</td>
      <td style="text-align:right;padding-right:12px;color:#ff1a1a;">${s.score}</td>
    `;
    tr.style.transition = 'background 0.25s ease';
    tr.addEventListener('mouseover', () => (tr.style.background = 'rgba(255,0,0,0.25)'));
    tr.addEventListener('mouseout', () => (tr.style.background = 'transparent'));
    body.appendChild(tr);
  });
  table.appendChild(body);
  wrap.appendChild(table);

  // 🔘 Botão fechar
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn--blood-primary';
  closeBtn.textContent = 'Fechar ✖';
  closeBtn.style.marginTop = '24px';
  closeBtn.addEventListener('click', () => overlay.remove());
  wrap.appendChild(closeBtn);

  overlay.appendChild(wrap);
  document.body.appendChild(overlay);
}
