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
  const spectatorTurnLog = document.getElementById('spectator-turn-log');
  const spectatorLogState = document.getElementById('spectator-log-state');
  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  let lastResolvedAt = 0;
  let previousMessages = { p1: '', p2: '' };

  openRulesButtons.forEach((btn) => btn.addEventListener('click', () => window.AM.openRulesModal()));

  function phaseLabel(state) {
    if (state.phase === 'lobby') return '対戦開始前';
    if (state.phase === 'finished') return '対戦終了';
    const turnLabel = `${window.AM.formatTurnLabel ? window.AM.formatTurnLabel(state.turnSummary?.turn || state.turn) : `ターン${state.turnSummary?.turn || state.turn}`}`;
    if (state.turnExecutionStage === 'selection') return `${turnLabel}行動選択中`;
    return turnLabel;
  }

  function actionClassFromLabel(label) {
    if (!label) return 'waiting';
    if (label.includes('攻撃')) return 'attack';
    if (label.includes('回復') || label.includes('反撃のドラ')) return 'heal';
    if (label.includes('防御')) return 'guard';
    if (label.includes('回避')) return 'evade';
    if (label.includes('(スキル)')) return 'skill';
    return 'waiting';
  }

  function clipText(text, max = 26) {
    if (!text) return '';
    const s = String(text);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  }

  function dragonState(player) {
    if (player.emergencyHealUsed) return 'ドラ 使用済';
    if (player.hp <= 15) return 'ドラ 発動可';
    return '';
  }

  function miniTags(player) {
    const parts = [];
    parts.push(`スキル ${(player.usedSkills || []).length}/3`);
    parts.push(`回復 残${Math.max(0, 1 - (player.normalHealUsed || 0))}`);
    const dragon = dragonState(player);
    if (dragon) parts.push(dragon);
    return parts.map((part) => `<span class="spectator-mini-badge">${window.AM.escapeHtml(part)}</span>`).join('');
  }

  function currentOrderText(state, role) {
    const firstRole = state.pendingTurnData?.firstRole || state.firstAttackRole || state.turnSummary?.firstPlayerRole;
    if (state.phase === 'battle' && firstRole) {
      if (state.turnExecutionStage === 'selection') return `次：${firstRole === role ? '先' : '後'}`;
      return firstRole === role ? '先' : '後';
    }
    return '待';
  }

  function getDisplaySnapshot(state, role) {
    return state.players[role];
  }

  function renderHeaderStatus(state, messagePulseRoles) {
    const p1 = state.players.p1, p2 = state.players.p2;
    phaseBanner.textContent = phaseLabel(state);
    phaseBanner.classList.toggle('final-turn', state.phase === 'battle' && state.turn === 10);
    topReadyRow.innerHTML = '';
    topReadyRow.classList.add('hidden');
    const leftBubble = p1.message ? `<div class="chat-slot left"><div class="chat-bubble left${messagePulseRoles.p1 ? ' chat-bounce' : ''}"><span class="chat-bubble-text">${window.AM.escapeHtml(clipText(p1.message))}</span></div></div>` : '<div class="chat-slot left"></div>';
    const rightBubble = p2.message ? `<div class="chat-slot right"><div class="chat-bubble right${messagePulseRoles.p2 ? ' chat-bounce' : ''}"><span class="chat-bubble-text">${window.AM.escapeHtml(clipText(p2.message))}</span></div></div>` : '<div class="chat-slot right"></div>';
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
        <div class="bet-overlay-title">対戦開始</div>
        <div class="bet-overlay-total">合計BET額 ${window.AM.escapeHtml(String(matchBet.total || 0))}G</div>
        <div class="bet-overlay-breakdown">${window.AM.escapeHtml(matchBet.p1?.name || 'プレイヤー1')}：${window.AM.escapeHtml(String(matchBet.p1?.bet || 0))}G / ${window.AM.escapeHtml(matchBet.p2?.name || 'プレイヤー2')}：${window.AM.escapeHtml(String(matchBet.p2?.bet || 0))}G</div>
      </div>`;
  }

  function renderPlayer(state, role, options = {}) {
    const actualPlayer = state.players[role];
    const player = getDisplaySnapshot(state, role);
    const body = window.AM.findBody(actualPlayer.bodyId);
    const pendingFirstOnly = state.phase === 'battle' && state.turnExecutionStage === 'first' && state.pendingTurnData;
    const allowSummary = !(pendingFirstOnly && role !== state.pendingTurnData.firstRole);
    const summary = state.turnSummary?.entries?.[role] || null;
    const hp = Math.max(0, Math.min(100, player.hp));
    const shield = Math.max(0, player.shield || 0);
    const shieldWithin = Math.max(0, Math.min(100 - hp, shield));
    const overClass = hp + shield > 100 ? 'over' : '';
    const anim = allowSummary ? (summary?.animation || null) : null;
    const resultClass = state.phase === 'finished' ? (state.winner === role ? 'winner-side' : state.winner && state.winner !== 'draw' ? 'loser-side' : '') : '';
    const orderText = currentOrderText(state, role);
    const choiceLabel = allowSummary ? (summary?.choiceLabel || '') : '';
    const hpDelta = Number(summary?.currentHpDelta || 0);
    const hpDeltaLabel = summary?.currentHpDeltaLabel || 'HP：変動なし';
    const effects = [window.AM.createEffectBadges(actualPlayer), dragonState(actualPlayer) ? `<span class="effect-badge">${window.AM.escapeHtml(dragonState(actualPlayer).replace('ドラ ', ''))}</span>` : ''].filter(Boolean).join('');
    const choiceClass = actionClassFromLabel(choiceLabel);
    const statusText = actualPlayer.actionLocked ? '行動選択済み' : '行動選択中';
    return `
      <div class="spectator-player ${resultClass}">
        <div class="spectator-name-row compact">
          <div class="spectator-body-icon${options.animateMessage ? ' body-icon-ping' : ''}">${window.AM.createBodyIconHTML(body, actualPlayer.name)}</div>
          <div class="spectator-name-block grow">
            <div class="name-and-action-row with-inline-status right-justified final-right-layout">
              <div class="spectator-name large">${window.AM.escapeHtml(actualPlayer.name || (role === 'p1' ? 'プレイヤー1' : 'プレイヤー2'))}</div>
              <div class="player-inline-badges final-right-badges"><span class="ready-badge ${actualPlayer.actionLocked ? 'ready' : 'waiting'} same-height">${statusText}</span><span class="player-corner-order ${orderText.includes('先') ? 'first' : orderText.includes('後') ? 'second' : 'idle'} same-height inline-order static-order">${window.AM.escapeHtml(orderText)}</span></div>
            </div>
          </div>
        </div>
        <div class="hp-row compact-row">
          <img src="assets/images/ui/icon_heart.png" alt="" class="hp-heart${options.animateDamage && hpDelta < 0 ? ' damaged' : ''}" />
          <div class="hp-bar-wrap"><div class="hp-bar thick ${overClass}"><div class="hp-fill" style="width:${hp}%"></div>${shieldWithin > 0 ? `<div class="shield-fill" style="left:${hp}%;width:${shieldWithin}%"></div>` : ''}</div></div>
          <div class="hp-number">${window.AM.formatHpShield(player.hp, shield)}</div>
        </div>
        <div class="spectator-card-row fixed-heights reflow-card-row">
          <div class="mini-skill-card ${anim ? '' : 'empty-mini'}">${anim ? `<img src="${window.AM.escapeHtml(anim.imagePath)}" alt="${window.AM.escapeHtml(anim.cardName)}" class="mini-card-image same-size" /><div class="mini-card-text"><div class="mini-card-title">${window.AM.escapeHtml(anim.skillName)}</div><div class="mini-card-effect larger-effect">${window.AM.escapeHtml(anim.effectShort)}</div></div>` : `<div class="single-line centered">このターンのスキル発動なし</div>`}</div>
          <div class="mini-log-card fixed-log spacious-log-card compact-result-card">
            <div class="result-strip"><span class="choice-badge ${choiceClass}">${window.AM.escapeHtml(choiceLabel || '行動待機中')}</span></div>
            <div class="spectator-mini-badges detail-row"><span class="spectator-mini-badge">スキル残 ${Math.max(0, 3 - (actualPlayer.usedSkills || []).length)}</span><span class="spectator-mini-badge">回復残 ${Math.max(0, 1 - (actualPlayer.normalHealUsed || 0))}</span><span class="spectator-mini-badge">ドラ ${actualPlayer.emergencyHealUsed ? '発動済み' : '未発動'}</span>${effects || ''}</div>
            ${hpDeltaLabel ? `<div class="hp-result bottom">${window.AM.escapeHtml(hpDeltaLabel)}</div>` : '<div class="hp-result bottom placeholder"></div>'}
          </div>
        </div>
      </div>`;
  }

  function renderSpectatorTurnLog(state) {
    if (!state.turnSummary) {
      spectatorLogState.textContent = '';
      spectatorTurnLog.innerHTML = '<div class="empty-note">ログはまだありません。</div>'; 
      return;
    }
    const lines = state.spectatorLogView === 'second' ? state.turnSummary.secondLines : state.turnSummary.firstLines;
    const title = state.spectatorLogView === 'second' ? '後攻ログ' : '先攻ログ';
    if (spectatorLogState) spectatorLogState.textContent = title;
    spectatorTurnLog.innerHTML = `${(lines || []).map((line) => `<div class="player-log-line">${window.AM.decorateLogLine ? window.AM.decorateLogLine(String(line)) : window.AM.escapeHtml(String(line))}</div>`).join('')}`;
  }

  function renderResult(state) {
    if (state.phase !== 'finished' || !state.resultSummary || !state.resultRevealVisible) {
      resultOverlay.classList.add('hidden');
      resultOverlay.innerHTML = '';
      return;
    }
    const rs = state.resultSummary;
    resultOverlay.classList.remove('hidden');
    if (state.winner === 'draw') {
      resultOverlay.innerHTML = `
        <div class="result-panel">
          <h2>対戦終了</h2>
          <div class="result-winner">⚖️ DRAW</div><div class="result-turns">各プレイヤーのBET額は返還されました</div>
          <div class="result-columns">
            <div class="result-win-col"><div class="result-role-label">DRAW</div><h3>${window.AM.escapeHtml(rs.players.p1.name)}</h3><p>総与ダメ：${rs.players.p1.damageDealt}</p><p>被ダメ：${rs.players.p1.damageTaken}</p></div>
            <div class="result-win-col"><div class="result-role-label">DRAW</div><h3>${window.AM.escapeHtml(rs.players.p2.name)}</h3><p>総与ダメ：${rs.players.p2.damageDealt}</p><p>被ダメ：${rs.players.p2.damageTaken}</p></div>
          </div>
        </div>`;
      return;
    }
    const winner = rs.players[state.winner];
    const loser = rs.players[state.winner === 'p1' ? 'p2' : 'p1'];
    resultOverlay.innerHTML = `
      <div class="result-panel">
        <h2>対戦終了</h2>
        <div class="result-columns">
          <div class="result-win-col"><div class="result-role-label">👑WINNER</div><h3>${window.AM.escapeHtml(winner.name)}</h3><p>受取BET額：${state.matchBet?.total || 0}G</p><p>総与ダメ：${winner.damageDealt}</p><p>被ダメ：${winner.damageTaken}</p></div>
          <div class="result-lose-col"><div class="result-role-label">☠️LOSER</div><h3>${window.AM.escapeHtml(loser.name)}</h3><p>総与ダメ：${loser.damageDealt}</p><p>被ダメ：${loser.damageTaken}</p></div>
        </div>
      </div>`;
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
    renderSpectatorTurnLog(state);
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
