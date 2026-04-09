(function () {
  const roomInput = document.getElementById('spectator-room-code');
  const leftPane = document.getElementById('spectator-left');
  const rightPane = document.getElementById('spectator-right');
  const openRulesButtons = document.querySelectorAll('[data-open-rules]');
  const phaseBanner = document.getElementById('phase-banner');
  const topReadyRow = document.getElementById('top-ready-row');
  const chatRow = document.getElementById('chat-row');
  const betOverlay = document.getElementById('bet-overlay');
  const resultOverlay = document.getElementById('result-overlay');
  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  let lastResolvedAt = 0;
  let previousMessages = { p1: '', p2: '' };

  openRulesButtons.forEach((btn) => btn.addEventListener('click', () => window.AM.openRulesModal()));

  function phaseLabel(state) {
    if (state.phase === 'lobby') return '対戦開始前';
    if (state.phase === 'finished') return '対戦終了';
    return `ターン${state.turnSummary?.turn || state.turn}`;
  }

  function actionType(action) {
    if (!action) return 'waiting';
    if (action.type === 'attack') return 'attack';
    if (action.type === 'heal') return 'heal';
    if (action.type === 'guard') return 'guard';
    if (action.type === 'evade') return 'evade';
    if (action.type === 'skill') return 'skill';
    return 'waiting';
  }

  function renderHeaderStatus(state, messagePulseRoles) {
    const p1 = state.players.p1, p2 = state.players.p2;
    phaseBanner.textContent = phaseLabel(state);
    topReadyRow.innerHTML = `
      <div class="status-pill big ${p1.actionLocked ? 'ready' : 'waiting'}">プレイヤー1：${p1.actionLocked ? '行動選択済み' : '行動選択中…'}</div>
      <div class="status-pill big ${p2.actionLocked ? 'ready' : 'waiting'}">プレイヤー2：${p2.actionLocked ? '行動選択済み' : '行動選択中…'}</div>`;
    const leftBubble = p1.message ? `<div class="chat-slot left"><div class="chat-bubble left"><span class="chat-bubble-text">${window.AM.escapeHtml(p1.message)}</span></div></div>` : '<div class="chat-slot left"></div>' ;
    const rightBubble = p2.message ? `<div class="chat-slot right"><div class="chat-bubble right"><span class="chat-bubble-text">${window.AM.escapeHtml(p2.message)}</span></div></div>` : '<div class="chat-slot right"></div>' ;
    chatRow.innerHTML = `${leftBubble}${rightBubble}`;
  }

  function renderBetOverlay(state) {
    if (!state.matchBet || !state.betRevealVisible || (state.phase !== 'battle' && state.phase !== 'finished')) {
      betOverlay.classList.add('hidden');
      betOverlay.innerHTML = '';
      return;
    }
    const matchBet = state.matchBet;
    betOverlay.classList.remove('hidden');
    betOverlay.innerHTML = `
      <div class="bet-overlay-panel">
        <div class="bet-overlay-title">本マッチのBET額</div>
        <div class="bet-overlay-total">合計 ${window.AM.escapeHtml(String(matchBet.total || 0))}G</div>
        <div class="bet-overlay-breakdown">${window.AM.escapeHtml(matchBet.p1?.name || 'プレイヤー1')}：${window.AM.escapeHtml(String(matchBet.p1?.bet || 0))}G / ${window.AM.escapeHtml(matchBet.p2?.name || 'プレイヤー2')}：${window.AM.escapeHtml(String(matchBet.p2?.bet || 0))}G</div>
      </div>`;
  }

  function renderPlayer(state, role, options = {}) {
    const player = state.players[role];
    const body = window.AM.findBody(player.bodyId);
    const summary = state.turnSummary?.entries?.[role];
    const hp = Math.max(0, Math.min(100, player.hp));
    const shield = Math.max(0, player.shield || 0);
    const shieldWithin = Math.max(0, Math.min(100 - hp, shield));
    const overClass = hp + shield > 100 ? 'over' : '';
    const anim = (state.lastAnimations || {})[role];
    const resultClass = state.phase === 'finished' ? (state.winner === role ? 'winner-side' : state.winner && state.winner !== 'draw' ? 'loser-side' : '') : '';
        const orderText = state.turnSummary ? (state.turnSummary.firstPlayerRole === role ? '先攻' : '後攻') : '待機';
    const currentAction = summary?.choiceLabel || '';
    const actionClass = actionType(summary ? {type:(summary.choiceLabel||'').includes('攻撃')?'attack':(summary.choiceLabel||'').includes('回復')?'heal':(summary.choiceLabel||'').includes('防御')?'guard':(summary.choiceLabel||'').includes('回避')?'evade':(summary.choiceLabel||'').includes('スキル')?'skill':'waiting'} : null) || 'waiting';
    const effectBadges = window.AM.createEffectBadges(player);
    const receivedLines = (summary?.receivedLines?.length ? summary.receivedLines : ['まだ実行結果がありません']).map((line) => `<div class="mini-log-line">${window.AM.escapeHtml(String(line).replace('瀕死回復','反撃のドラ').replace(/「|」/g,''))}</div>`).join('');
    const hpDelta = summary ? (summary.hpAfter - summary.hpBefore) : 0;
    const hpDeltaLabel = `最終HP変動：${hpDelta>0?'+':''}${hpDelta}`;
    const damagedClass = options.animateDamage && hpDelta < 0 ? ' damaged' : '';
    const skillText = anim ? window.AM.escapeHtml(anim.effectShort.replace('瀕死回復','反撃のドラ')) : '';
    return `
      <div class="spectator-player ${resultClass}">
        
        <div class="player-corner-order ${orderText === '先攻' ? 'first' : orderText === '後攻' ? 'second' : 'idle'}">${orderText}</div>
        <div class="spectator-name-row compact">
          <div class="spectator-body-icon${options.animateMessage ? " body-icon-ping" : ""}">${window.AM.createBodyIconHTML(body, player.name)}</div>
          <div class="spectator-name-block grow">
            <div class="name-and-action-row">
              <div class="spectator-name large">${window.AM.escapeHtml(player.name || (role === 'p1' ? 'プレイヤー1' : 'プレイヤー2'))}</div>
            </div>
          </div>
        </div>
        <div class="hp-row compact-row">
          <img src="assets/images/ui/icon_heart.png" alt="" class="hp-heart${damagedClass}" />
          <div class="hp-bar-wrap"><div class="hp-bar thick ${overClass}"><div class="hp-fill" style="width:${hp}%"></div>${shieldWithin > 0 ? `<div class="shield-fill" style="left:${hp}%;width:${shieldWithin}%"></div>` : ''}</div></div>
          <div class="hp-number">${window.AM.formatHpShield(player.hp, player.shield || 0)}</div>
        </div>
        ${state.phase === 'lobby'
          ? `<div class="spectator-meta-row larger-meta pending-bet-row"><div class="spectator-meta pending-bet-meta"><img src="assets/images/ui/icon_coin.png" class="inline-icon" alt=""> BET額設定中</div></div>`
          : `<div class="spectator-meta-row larger-meta"><div class="spectator-meta"><img src="assets/images/ui/icon_coin.png" class="inline-icon" alt=""> 所持：${player.gold}G</div><div class="spectator-meta">BET：${player.bet || 50}G${player.debt > 0 ? `（借金${player.debt}G）` : ''}</div></div>`}
        <div class="spectator-card-row fixed-heights">
          <div class="mini-skill-card ${anim ? '' : 'empty-mini'}">${anim ? `<img src="${window.AM.escapeHtml(anim.imagePath)}" alt="${window.AM.escapeHtml(anim.cardName)}" class="mini-card-image same-size" /><div class="mini-card-text"><div class="mini-card-title">${window.AM.escapeHtml(anim.skillName.replace('瀕死回復','反撃のドラ'))}</div><div class="mini-card-effect larger-effect">${skillText}</div></div>` : `<div class="single-line centered">このターンのスキル発動なし</div>`}</div>
          <div class="mini-log-card fixed-log"><div class="result-strip">${currentAction ? `<span class="choice-badge ${actionClass}">${window.AM.escapeHtml(currentAction.replace('瀕死回復','反撃のドラ'))}</span>` : `<span class="choice-badge waiting">行動未表示</span>`}<span class="hp-result">${window.AM.escapeHtml(hpDeltaLabel)}</span></div>${effectBadges ? `<div class="effects-row spectator-effects">${effectBadges}</div>` : ''}<div class="received-lines-scroll" tabindex="0">${receivedLines}</div></div>
        </div>
      </div>`;
  }

  function renderResult(state) {
    if (state.phase !== 'finished' || !state.resultSummary) {
      resultOverlay.classList.add('hidden');
      return;
    }
    const rs = state.resultSummary;
    const p1 = rs.players.p1, p2 = rs.players.p2;
    resultOverlay.classList.remove('hidden');
    const crown1 = rs.winnerRole==='p1' ? '👑 ' : ''; const crown2 = rs.winnerRole==='p2' ? '👑 ' : '';
    resultOverlay.innerHTML = `<div class="result-panel"><h2>対戦終了</h2><div class="result-winner">${window.AM.escapeHtml(rs.winnerName)}の勝利！</div><div class="result-turns">${rs.turns}ターンで決着</div><div class="result-columns"><div class="${rs.winnerRole==='p1'?'result-win-col':'result-lose-col'}"><div class="result-role-label">${rs.winnerRole==='p1'?'WINNER':'LOSER'}</div><h3>${crown1}${window.AM.escapeHtml(p1.name)}</h3><p>与ダメージ：${p1.damageDealt}</p><p>被ダメージ：${p1.damageTaken}</p></div><div class="${rs.winnerRole==='p2'?'result-win-col':'result-lose-col'}"><div class="result-role-label">${rs.winnerRole==='p2'?'WINNER':'LOSER'}</div><h3>${crown2}${window.AM.escapeHtml(p2.name)}</h3><p>与ダメージ：${p2.damageDealt}</p><p>被ダメージ：${p2.damageTaken}</p></div></div><div class="result-gold">${window.AM.escapeHtml(rs.rewardText)}</div><div class="result-gold-sub">${window.AM.escapeHtml(p1.name)}：${p1.gold}G${p1.debt > 0 ? `（借金${p1.debt}G）` : ''} / ${window.AM.escapeHtml(p2.name)}：${p2.gold}G${p2.debt > 0 ? `（借金${p2.debt}G）` : ''}</div></div>`;
  }

  function render(state) {
    const resolvedChanged = !!state.turnResolvedAt && state.turnResolvedAt !== lastResolvedAt;
    const messagePulseRoles = {
      p1: !!state.players.p1.message && state.players.p1.message !== previousMessages.p1,
      p2: !!state.players.p2.message && state.players.p2.message !== previousMessages.p2
    };
    renderHeaderStatus(state, messagePulseRoles);
    leftPane.innerHTML = renderPlayer(state, 'p1', { animateDamage: resolvedChanged, animateMessage: messagePulseRoles.p1 });
    rightPane.innerHTML = renderPlayer(state, 'p2', { animateDamage: resolvedChanged, animateMessage: messagePulseRoles.p2 });
    renderBetOverlay(state);
    renderResult(state);
    lastResolvedAt = state.turnResolvedAt || lastResolvedAt;
    previousMessages = { p1: state.players.p1.message || '', p2: state.players.p2.message || '' };
  }

  let unsubscribe = window.AM.subscribeState(currentRoom, render);
  roomInput.addEventListener('change', () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    unsubscribe();
    unsubscribe = window.AM.subscribeState(currentRoom, render);
    render(window.AM.loadState(currentRoom));
  });
  render(window.AM.loadState(currentRoom));
})();
