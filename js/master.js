(function () {
  const roomInput = document.getElementById('master-room-code');
  const createBtn = document.getElementById('create-room');
  const startBtn = document.getElementById('start-match');
  const rematchBtn = document.getElementById('rematch-match');
  const resolveBtn = document.getElementById('resolve-turn');
  const resetBtn = document.getElementById('reset-match');
  const betToolbar = document.getElementById('bet-visibility-toolbar');
  const showBetBtn = document.getElementById('show-bet-overlay');
  const hideBetBtn = document.getElementById('hide-bet-overlay');
  const toggleLogBtn = document.getElementById('toggle-log-view');
  const toggleResultBtn = document.getElementById('toggle-result-overlay');
  const roomCreateStatus = document.getElementById('room-create-status');
  const roomCurrent = document.getElementById('master-room-current');
  const masterControlGrid = document.querySelector('.master-control-grid');
  const actionStatus = document.getElementById('action-status');
  const playerColumns = document.getElementById('player-columns');
  const battleStatusReview = document.getElementById('master-status-review');
  const battleLog = document.getElementById('master-log');
  const masterTurnSelect = document.getElementById('master-turn-select');
  const masterTurnSelectWrap = document.getElementById('master-turn-select-wrap');

  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  const panelOpen = { p1: false, p2: false };
  let selectedMasterTurn = 0;

  function load() { return window.AM.loadState(currentRoom); }
  function subscribe() { return window.AM.subscribeState(currentRoom, render); }

  let unsubscribe = subscribe();

  function isReadyToStart(player) {
    return !!(player.joined && player.bodyId && Array.isArray(player.selectedCards) && player.selectedCards.length === 3);
  }

  function actionSummary(action) {
    return window.AM.escapeHtml(String(window.AM.describeAction(action) || '未確定'));
  }

  function dragonState(player) {
    if (player.emergencyHealUsed) return '使用済';
    if (player.hp <= 15) return '発動可';
    return '未解放';
  }

  function currentOrderText(state, role) {
    if (state.phase !== 'battle') return '待機';
    return state.firstAttackRole === role ? '先攻' : '後攻';
  }

  function nextOrderText(state, role) {
    if (state.phase !== 'battle') return '待機';
    const nextFirst = state.firstAttackRole === 'p1' ? 'p2' : 'p1';
    return nextFirst === role ? '先攻' : '後攻';
  }

  function getDisplaySnapshot(state, role) {
    return state.players[role];
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
    const open = panelOpen[role];
    return `
      <div class="master-player-toggle" data-role="${role}">
        <button type="button" class="master-toggle-button ${open ? 'is-open' : ''}" data-toggle-role="${role}">${title}</button>
        <div class="master-toggle-panel ${open ? '' : 'hidden'}" data-panel-role="${role}">
          <div class="master-player-meta">
            <div><strong>プレイヤー名：</strong>${window.AM.escapeHtml(player.name || (role === 'p1' ? 'プレイヤー1' : 'プレイヤー2'))}</div>
            <div><strong>参加状態：</strong>${player.joined ? '参加済み' : '未参加'}</div>
            <div><strong>所持G / BET：</strong>${player.gold}G / ${player.bet || 50}G${player.debt > 0 ? `（借金${player.debt}G）` : ''}</div>
            <div><strong>スキル使用数：</strong>${(player.usedSkills || []).length}/3</div>
            <div><strong>回復残：</strong>${Math.max(0, 1 - (player.normalHealUsed || 0))}</div>
            <div><strong>ドラ状態：</strong>${dragonState(player)}</div>
            <div><strong>現在の行動：</strong>${actionSummary(player.submittedAction)}</div>
          </div>
          <div class="master-subtitle">ボディ</div>
          ${renderCompactBody(body)}
          <div class="effects-row">${window.AM.createEffectBadges(player) || '<span class="empty-note">継続効果なし</span>'}</div>
          <div class="master-subtitle">デッキ</div>
          <div class="master-deck">${cards.map((card) => window.AM.createCardHTML(card, (player.usedSkills || []).includes(card.skillKey) ? '使用済み' : '未使用')).join('') || '<div class="empty-note">未登録</div>'}</div>
        </div>
      </div>`;
  }

  function renderHp(player) {
    const hpWidth = Math.max(0, Math.min(100, player.hp));
    const shield = Math.max(0, player.shield || 0);
    const shieldWithin = Math.max(0, Math.min(100 - hpWidth, shield));
    const overClass = player.hp + shield > 100 ? 'over' : '';
    return `
      <div class="status-hp-wrap ${overClass}">
        <div class="status-hp-row">
          <img src="assets/images/ui/icon_heart.png" alt="" class="status-heart" />
          <div class="hp-bar thick ${overClass}">
            <div class="hp-fill" style="width:${hpWidth}%"></div>
            ${shieldWithin > 0 ? `<div class="shield-fill" style="left:${hpWidth}%;width:${shieldWithin}%"></div>` : ''}
          </div>
          <div class="status-hp-number">${window.AM.formatHpShield(player.hp, shield)}</div>
        </div>
      </div>`;
  }

  function renderBattleStatusCard(state, role) {
    const player = getDisplaySnapshot(state, role);
    const summary = state.turnSummary?.entries?.[role];
    const received = summary?.receivedLines?.length ? summary.receivedLines.join(' / ') : 'まだ実行結果がありません';
    const currentAction = player.actionLocked ? actionSummary(player.submittedAction) : '未確定';
    return `
      <div class="status-card">
        <h3>${window.AM.escapeHtml(player.name || (role === 'p1' ? 'プレイヤー1' : 'プレイヤー2'))}</h3>
        ${renderHp(player)}
        <div class="status-line">スキル ${(player.usedSkills || []).length}/3 ・ 回復 残${Math.max(0, 1 - (player.normalHealUsed || 0))} ・ ドラ ${dragonState(player)}</div>
        <div class="status-line">現在：${currentOrderText(state, role)} ／ 次：${nextOrderText(state, role)}</div>
        <div class="effects-row">${window.AM.createEffectBadges(player) || '<span class="empty-note compact">継続効果なし</span>'}</div>
      </div>`;
  }

  function renderActionStatus(state) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    if (state.phase === 'finished' && state.resultSummary) {
      const rs = state.resultSummary;
      if (state.winner === 'draw') {
        actionStatus.innerHTML = `
          <div class="action-status-result">
            <div class="result-title">対戦終了</div>
            <div class="result-winner">⚖️ DRAW</div>
            <div class="result-sub">BET返還：${state.matchBet?.p1?.bet || 0}G / ${state.matchBet?.p2?.bet || 0}G</div>
            <div class="result-sub">${window.AM.escapeHtml(rs.players.p1.name)}（総与ダメ：${rs.players.p1.damageDealt} / 被ダメ：${rs.players.p1.damageTaken}）</div>
            <div class="result-sub">${window.AM.escapeHtml(rs.players.p2.name)}（総与ダメ：${rs.players.p2.damageDealt} / 被ダメ：${rs.players.p2.damageTaken}）</div>
          </div>`;
      } else {
        const winner = rs.players[state.winner];
        const loserRole = state.winner === 'p1' ? 'p2' : 'p1';
        const loser = rs.players[loserRole];
        actionStatus.innerHTML = `
          <div class="action-status-result">
            <div class="result-title">対戦終了</div>
            <div class="result-winner">👑 ${window.AM.escapeHtml(winner.name)}</div>
            <div class="result-sub">WINNER：${window.AM.escapeHtml(winner.name)}（総与ダメ：${winner.damageDealt} / 被ダメ：${winner.damageTaken}）</div>
            <div class="result-sub">LOSER：${window.AM.escapeHtml(loser.name)}（総与ダメ：${loser.damageDealt} / 被ダメ：${loser.damageTaken}）</div>
          </div>`;
      }
      return;
    }
    const centerLabel = state.phase === 'battle' ? window.AM.formatTurnLabel(state.turn) : '対戦開始前';
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

  function renderRoomStatus(state) {
    const created = !!state.roomCreated;
    if (!created) {
      roomCreateStatus.textContent = 'ルーム未作成';
      createBtn.textContent = 'ルーム作成';
      roomInput.disabled = false;
      roomInput.parentElement.classList.remove('hidden');
      roomCurrent.classList.add('hidden');
      roomCurrent.textContent = '';
      masterControlGrid?.classList.remove('room-created');
    } else {
      roomCreateStatus.textContent = `● ルーム作成済み：${currentRoom}`;
      createBtn.textContent = '作成済み';
      roomInput.disabled = true;
      roomInput.parentElement.classList.add('hidden');
      roomCurrent.classList.add('hidden');
      roomCurrent.textContent = '';
      masterControlGrid?.classList.add('room-created');
    }
  }

  function syncToolbarByPhase(state) {
    const ready = isReadyToStart(state.players.p1) && isReadyToStart(state.players.p2);
    const roomCreated = !!state.roomCreated;
    createBtn.classList.toggle('hidden', roomCreated);
    startBtn.classList.toggle('hidden', !(state.phase === 'lobby' && ready));
    resolveBtn.classList.toggle('hidden', state.phase !== 'battle');
    rematchBtn.classList.toggle('hidden', state.phase !== 'finished');
    resetBtn.classList.remove('hidden');
    const showControls = state.phase === 'battle' || state.phase === 'finished';
    betToolbar.classList.toggle('hidden', !showControls);
    if (showControls) {
      showBetBtn.disabled = !!state.betRevealVisible;
      hideBetBtn.disabled = !state.betRevealVisible;
      toggleLogBtn.textContent = `対戦ログ：${state.spectatorLogView === 'first' ? '先攻表示中' : '後攻表示中'}`;
      toggleLogBtn.classList.toggle('first-view', state.spectatorLogView === 'first');
      toggleLogBtn.classList.toggle('second-view', state.spectatorLogView === 'second');
      toggleResultBtn.textContent = `リザルト：${state.resultRevealVisible ? '表示中' : '非表示中'}`;
    }
    if (state.phase === 'battle') {
      const isSecond = state.turnExecutionStage === 'second';
      resolveBtn.textContent = isSecond ? 'ターン実行(後攻)' : 'ターン実行(先攻)';
      resolveBtn.classList.toggle('second-step', isSecond);
      resolveBtn.classList.toggle('first-step', !isSecond);
    } else {
      resolveBtn.textContent = 'ターン実行(先攻)';
      resolveBtn.classList.remove('second-step');
      resolveBtn.classList.add('first-step');
    }
  }

  function renderLog(state) {
    const histories = [];
    if (state.phase === 'battle' && state.turnSummary) histories.push(state.turnSummary);
    histories.push(...(state.turnHistories || []));
    masterTurnSelectWrap.classList.toggle('hidden', !histories.length);
    if (masterTurnSelect) {
      masterTurnSelect.innerHTML = histories.map((history, index) => `<option value="${index}">${window.AM.formatTurnLogLabel ? window.AM.formatTurnLogLabel(history.turn) : `${history.turn}ターン目`}</option>`).join('');
      if (selectedMasterTurn >= histories.length) selectedMasterTurn = 0;
      masterTurnSelect.value = String(selectedMasterTurn);
      masterTurnSelect.onchange = () => { selectedMasterTurn = Number(masterTurnSelect.value || 0); render(load()); };
    }
    const selected = histories[selectedMasterTurn];
    if (!selected) {
      battleLog.innerHTML = '<div class="empty-note">ログはまだありません。</div>';
      return;
    }
    const isCurrentPending = selected === state.turnSummary && !!state.pendingTurnData;
    const blocks = [];
    const addBlock = (title, lines) => {
      if (!lines || !lines.length) return;
      blocks.push(`<div class="turn-role-label">${title}</div>${lines.map((line) => `<div class="player-log-line">${window.AM.decorateLogLine ? window.AM.decorateLogLine(String(line)) : window.AM.escapeHtml(String(line))}</div>`).join('')}`);
    };
    addBlock('先攻', (selected.firstLines || []).slice(1));
    if (!isCurrentPending) {
      addBlock('後攻', (selected.secondLines || []).slice(1));
      addBlock('結果', (selected.resultLines || []).slice(1));
    }
    battleLog.innerHTML = `<div class="status-card turn-history-card log-only-card full-width-log">${blocks.join('')}</div>`;
  }

  function render(state) {
    renderRoomStatus(state);
    syncToolbarByPhase(state);
    renderActionStatus(state);
    playerColumns.innerHTML = renderPlayerSection(state, 'p1') + renderPlayerSection(state, 'p2');
    battleStatusReview.innerHTML = renderBattleStatusCard(state, 'p1') + renderBattleStatusCard(state, 'p2');
    renderLog(state);

    playerColumns.querySelectorAll('[data-toggle-role]').forEach((button) => {
      button.addEventListener('click', () => {
        const role = button.getAttribute('data-toggle-role');
        panelOpen[role] = !panelOpen[role];
        render(load());
      });
    });
  }

  function createRoom() {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    window.AM.resetRoom(currentRoom);
    window.AM.updateState(currentRoom, (state) => {
      state.roomCreated = true;
      state.spectatorLogView = 'first';
      state.resultRevealVisible = false;
      state.betRevealVisible = false;
    });
    unsubscribe();
    unsubscribe = subscribe();
    render(load());
  }

  function startMatch() {
    try {
      window.AM.updateState(currentRoom, (state) => window.AM_BATTLE.startMatch(state));
    } catch (error) {
      alert(error.message);
    }
  }

  function resolveTurn() {
    try {
      window.AM.updateState(currentRoom, (state) => window.AM_BATTLE.resolveTurn(state));
    } catch (error) {
      alert(error.message);
    }
  }

  function rematchMatch() {
    if (!confirm('同じプレイヤーで再戦を行いますか？')) return;
    try {
      window.AM.updateState(currentRoom, (state) => window.AM_BATTLE.rematch(state));
    } catch (error) {
      alert(error.message);
    }
  }

  function resetMatch() {
    if (!confirm('このルームを初期化しますか？')) return;
    window.AM.resetRoom(currentRoom);
    unsubscribe();
    unsubscribe = subscribe();
    render(load());
  }

  function showBetOverlay() {
    window.AM.updateState(currentRoom, (state) => { state.betRevealVisible = true; });
  }

  function hideBetOverlay() {
    window.AM.updateState(currentRoom, (state) => { state.betRevealVisible = false; });
  }

  function toggleLogView() {
    window.AM.updateState(currentRoom, (state) => {
      state.spectatorLogView = state.spectatorLogView === 'second' ? 'first' : 'second';
    });
  }

  function toggleResultOverlay() {
    window.AM.updateState(currentRoom, (state) => {
      state.resultRevealVisible = !state.resultRevealVisible;
    });
  }

  roomInput.addEventListener('change', () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    unsubscribe();
    unsubscribe = subscribe();
    render(load());
  });
  createBtn.addEventListener('click', createRoom);
  startBtn.addEventListener('click', startMatch);
  rematchBtn.addEventListener('click', rematchMatch);
  resolveBtn.addEventListener('click', resolveTurn);
  resetBtn.addEventListener('click', resetMatch);
  showBetBtn.addEventListener('click', showBetOverlay);
  hideBetBtn.addEventListener('click', hideBetOverlay);
  toggleLogBtn.addEventListener('click', toggleLogView);
  toggleResultBtn.addEventListener('click', toggleResultOverlay);

  render(load());
})();
