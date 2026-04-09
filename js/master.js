(function () {
  const roomInput = document.getElementById("master-room-code");
  const createBtn = document.getElementById("create-room");
  const startBtn = document.getElementById("start-match");
  const rematchBtn = document.getElementById("rematch-match");
  const resolveBtn = document.getElementById("resolve-turn");
  const resetBtn = document.getElementById("reset-match");
  const betToolbar = document.getElementById("bet-visibility-toolbar");
  const showBetBtn = document.getElementById("show-bet-overlay");
  const hideBetBtn = document.getElementById("hide-bet-overlay");
  const actionStatus = document.getElementById("action-status");
  const playerColumns = document.getElementById("player-columns");
  const battleStatusReview = document.getElementById("master-status-review");
  const battleLog = document.getElementById("master-log");
  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  const panelOpen = { p1: false, p2: false };

  function getState() { return window.AM.loadState(currentRoom); }
  function createRoom() { currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM; window.AM.resetRoom(currentRoom); }
  function startMatch() { try { window.AM.updateState(currentRoom, (state) => window.AM_BATTLE.startMatch(state)); } catch (e) { alert(e.message); } }
  function resolveTurn() { try { window.AM.updateState(currentRoom, (state) => window.AM_BATTLE.resolveTurn(state)); } catch (e) { alert(e.message); } }
  function rematchMatch() {
    if (!confirm("同じプレイヤーで再戦を行いますか？")) return;
    try { window.AM.updateState(currentRoom, (state) => window.AM_BATTLE.rematch(state)); } catch (e) { alert(e.message); }
  }
  function resetMatch() { if (confirm("このルームを初期化しますか？")) createRoom(); }
  function showBetOverlay() { try { window.AM.updateState(currentRoom, (state) => { if (state.matchBet) state.betRevealVisible = true; }); } catch (e) { alert(e.message); } }
  function hideBetOverlay() { try { window.AM.updateState(currentRoom, (state) => { state.betRevealVisible = false; }); } catch (e) { alert(e.message); } }

  function isReadyToStart(player) {
    return !!(player.joined && player.bodyId && Array.isArray(player.selectedCards) && player.selectedCards.length === 3);
  }

  function syncToolbarByPhase(state) {
    const ready = isReadyToStart(state.players.p1) && isReadyToStart(state.players.p2);
    const showCreate = state.phase === 'lobby' && !ready;
    const showStart = state.phase === 'lobby' && ready;
    const showResolve = state.phase === 'battle';
    const showRematch = state.phase === 'finished';
    const showBetToolbar = (state.phase === 'battle' || state.phase === 'finished') && !!state.matchBet;
    createBtn.classList.toggle('hidden', !showCreate);
    startBtn.classList.toggle('hidden', !showStart);
    resolveBtn.classList.toggle('hidden', !showResolve);
    rematchBtn.classList.toggle('hidden', !showRematch);
    resetBtn.classList.remove('hidden');
    betToolbar.classList.toggle('hidden', !showBetToolbar);
    if (showBetToolbar) {
      showBetBtn.disabled = !!state.betRevealVisible;
      hideBetBtn.disabled = !state.betRevealVisible;
    }
  }

  function renderCompactBody(body) {
    if (!body) return '<div class="empty-note">ボディ未選択</div>';
    return `
      <div class="master-body-card">
        <img src="${window.AM.escapeHtml(body.imagePath)}" alt="${window.AM.escapeHtml(body.bodyName)}" class="master-body-image" />
        <div class="master-body-text">
          <div class="master-body-title">${window.AM.escapeHtml(body.bodyName)}</div>
          <div class="master-body-meta">HP ${window.AM.escapeHtml(String(body.hp || 100))}</div>
        </div>
      </div>`;
  }

  function renderPlayerSection(state, role) {
    const player = state.players[role];
    const body = window.AM.findBody(player.bodyId);
    const cards = (player.selectedCards || []).map((id) => window.AM.findCard(id)).filter(Boolean);
    const title = role === 'p1' ? 'プレイヤー1について' : 'プレイヤー2について';
    const actionText = player.actionLocked ? window.AM.describeAction(player.submittedAction) : '未確定';
    return `
      <div class="master-player-toggle" data-role="${role}">
        <button type="button" class="master-toggle-button ${panelOpen[role] ? 'is-open' : ''}" data-toggle-role="${role}">${title}</button>
        <div class="master-toggle-panel ${panelOpen[role] ? '' : 'hidden'}" data-panel-role="${role}">
          <div class="master-player-meta">
            <div><strong>プレイヤー名：</strong>${window.AM.escapeHtml(player.name || (role === 'p1' ? 'プレイヤー1' : 'プレイヤー2'))}</div>
            <div><strong>参加状態：</strong>${player.joined ? '参加済み' : '未参加'}</div>
            <div><strong>所持G / BET：</strong>${player.gold}G / ${player.bet || 50}G${player.debt > 0 ? `（借金${player.debt}G）` : ''}</div>
            <div><strong>現在の行動：</strong>${window.AM.escapeHtml(String(actionText).replace('瀕死回復','反撃のドラ'))}</div>
          </div>
          <div class="master-subtitle">ボディ</div>
          ${renderCompactBody(body)}
          <div class="effects-row">${window.AM.createEffectBadges(player) || '<span class="empty-note">継続効果なし</span>'}</div>
          <div class="master-subtitle">デッキ</div>
          <div class="master-deck">${cards.map((card) => window.AM.createCardHTML(card, player.usedSkills.includes(card.skillKey) ? '使用済み' : '未使用')).join('') || '<div class="empty-note">未登録</div>'}</div>
        </div>
      </div>`;
  }

  function renderHp(player) {
    const hpWidth = Math.max(0, Math.min(100, player.hp));
    const shieldWidth = Math.max(0, Math.min(100 - hpWidth, player.shield || 0));
    const overClass = (player.hp + (player.shield || 0)) > 100 ? 'over' : '';
    return `<div class="status-hp-wrap ${overClass}"><div class="status-hp-row"><img src="assets/images/ui/icon_heart.png" alt="" class="status-heart" /><div class="hp-bar thick ${overClass}"><div class="hp-fill" style="width:${hpWidth}%"></div>${shieldWidth > 0 ? `<div class="shield-fill" style="left:${hpWidth}%;width:${shieldWidth}%"></div>` : ''}</div><div class="status-hp-number">${window.AM.formatHpShield(player.hp, player.shield || 0)}</div></div></div>`;
  }

  function renderBattleStatusCard(state, role) {
    const player = state.players[role];
    const entry = state.turnSummary?.entries?.[role];
    const currentAction = player.actionLocked ? window.AM.describeAction(player.submittedAction) : '未確定';
    const received = entry?.receivedLines?.length ? entry.receivedLines.join(' / ') : 'まだ実行結果がありません';
    return `
      <div class="status-card">
        <h3>${window.AM.escapeHtml(player.name || (role === 'p1' ? 'プレイヤー1' : 'プレイヤー2'))}</h3>
        <div class="status-line">所持G: ${player.gold}G ${player.debt > 0 ? `（借金${player.debt}G）` : ''}</div>
        <div class="status-line">BET: ${player.bet || 50}G</div>
        ${renderHp(player)}
        <div class="status-line">通常回復: ${Math.max(0, 2 - player.normalHealUsed)}回</div>
        <div class="status-line">反撃のドラ: ${player.emergencyHealUsed ? '使用済み' : '未使用'}</div>
        <div class="status-line">選択中の行動: ${window.AM.escapeHtml(String(currentAction).replace('瀕死回復','反撃のドラ'))}</div>
        ${entry ? `<div class="status-line">直近の結果: ${window.AM.escapeHtml(received.replace(/「|」/g,''))}</div>` : ''}
        <div class="effects-row">${window.AM.createEffectBadges(player)}</div>
      </div>`;
  }

  function renderActionStatus(state) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    if (state.phase === 'finished' && state.resultSummary) {
      const winnerText = state.winner === 'draw' ? '引き分け' : `${window.AM.escapeHtml(state.players[state.winner]?.name || state.resultSummary.winnerName)}の勝利`;
      actionStatus.innerHTML = `
        <div class="action-status-result">
          <div class="result-title">リザルト</div>
          <div class="result-winner">👑 ${winnerText}</div>
          <div class="result-sub">${state.resultSummary.turns}ターンで決着 / ${window.AM.escapeHtml(state.resultSummary.rewardText)}</div>
          <div class="result-sub">${window.AM.escapeHtml(state.resultSummary.players.p1.name)}：${state.resultSummary.players.p1.gold}G${state.resultSummary.players.p1.debt > 0 ? `（借金${state.resultSummary.players.p1.debt}G）` : ''} ／ ${window.AM.escapeHtml(state.resultSummary.players.p2.name)}：${state.resultSummary.players.p2.gold}G${state.resultSummary.players.p2.debt > 0 ? `（借金${state.resultSummary.players.p2.debt}G）` : ''}</div>
        </div>`;
      return;
    }
    const centerLabel = state.phase === 'battle' ? `ターン ${state.turn}` : '対戦開始前';
    actionStatus.innerHTML = `
      <div class="action-status-chip ${p1.actionLocked ? 'is-ready' : 'is-waiting'}">
        <span class="label">${window.AM.escapeHtml(p1.name || 'プレイヤー1')}</span>
        <span class="value">${p1.actionLocked ? '入力済み' : '未入力'}</span>
      </div>
      <div class="action-status-chip turn-chip">${centerLabel}</div>
      <div class="action-status-chip ${p2.actionLocked ? 'is-ready' : 'is-waiting'}">
        <span class="label">${window.AM.escapeHtml(p2.name || 'プレイヤー2')}</span>
        <span class="value">${p2.actionLocked ? '入力済み' : '未入力'}</span>
      </div>`;
  }

  function render(state) {
    syncToolbarByPhase(state);
    renderActionStatus(state);
    playerColumns.innerHTML = renderPlayerSection(state, 'p1') + renderPlayerSection(state, 'p2');
    battleStatusReview.innerHTML = renderBattleStatusCard(state, 'p1') + renderBattleStatusCard(state, 'p2');
    battleLog.innerHTML = (state.battleLog || []).map((line) => `<div class="player-log-line">${window.AM.escapeHtml(String(line).replace('瀕死回復','反撃のドラ').replace(/「|」/g,''))}</div>`).join('') || '<div class="empty-note">ログはまだありません。</div>';

    playerColumns.querySelectorAll('[data-toggle-role]').forEach((button) => {
      button.addEventListener('click', () => {
        const role = button.getAttribute('data-toggle-role');
        panelOpen[role] = !panelOpen[role];
        const panel = playerColumns.querySelector(`[data-panel-role="${role}"]`);
        if (panel) panel.classList.toggle('hidden', !panelOpen[role]);
        button.classList.toggle('is-open', panelOpen[role]);
      });
    });
  }

  let unsubscribe = window.AM.subscribeState(currentRoom, render);
  roomInput.addEventListener("change", () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    unsubscribe();
    unsubscribe = window.AM.subscribeState(currentRoom, render);
    render(getState());
  });
  createBtn.addEventListener("click", createRoom);
  startBtn.addEventListener("click", startMatch);
  rematchBtn.addEventListener("click", rematchMatch);
  resolveBtn.addEventListener("click", resolveTurn);
  resetBtn.addEventListener("click", resetMatch);
  showBetBtn.addEventListener("click", showBetOverlay);
  hideBetBtn.addEventListener("click", hideBetOverlay);
  render(getState());
})();
