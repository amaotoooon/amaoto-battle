(function () {
  const roomInput = document.getElementById("spectator-room-code");
  const stateTop = document.getElementById("spectator-state");
  const leftPane = document.getElementById("spectator-left");
  const rightPane = document.getElementById("spectator-right");
  const logList = document.getElementById("spectator-log");
  const rulesOverlay = document.getElementById("spectator-rules");
  const openRulesButtons = document.querySelectorAll("[data-open-rules]");
  const turnChip = document.getElementById("turn-chip");
  const firstChip = document.getElementById("first-chip");
  const turnEvents = document.getElementById("turn-events");
  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  let previousState = null;

  openRulesButtons.forEach((btn) => btn.addEventListener("click", () => window.AM.openRulesModal()));
  function getState() { return window.AM.loadState(currentRoom); }

  function renderSkillCard(anim, role, state) {
    if (!anim) {
      return `<div class="mini-skill-card empty-mini">このターンのスキル発動なし</div>`;
    }
    const delta = state.turnSummary && state.turnSummary.hpDelta ? state.turnSummary.hpDelta[role] : 0;
    const effectClass = delta < 0 ? 'hit-spark' : delta > 0 ? 'heal-flash' : 'skill-glow';
    return `
      <div class="mini-skill-card ${effectClass} effect-${window.AM.escapeHtml(anim.effectType || '特殊')}">
        ${anim.imagePath ? `<img src="${window.AM.escapeHtml(anim.imagePath)}" alt="${window.AM.escapeHtml(anim.cardName)}" class="mini-card-image" />` : ''}
        <div class="mini-card-text">
          <div class="mini-card-title">${window.AM.escapeHtml(anim.cardName)}</div>
          <div class="mini-card-skill">${window.AM.escapeHtml(anim.skillName)}</div>
          <div class="mini-card-effect">${window.AM.escapeHtml(anim.effectShort)}</div>
        </div>
      </div>`;
  }

  function renderPlayer(state, role) {
    const player = state.players[role];
    const body = window.AM.findBody(player.bodyId);
    const percent = Math.max(0, Math.min(100, player.hp));
    const anim = (state.lastAnimations || {})[role];
    const bodyHtml = body
      ? `<div class="mini-body-card"><img src="${window.AM.escapeHtml(body.imagePath)}" alt="${window.AM.escapeHtml(body.bodyName)}" class="spectator-body-image" /><div class="mini-body-name">${window.AM.escapeHtml(body.bodyName)}</div></div>`
      : '<div class="mini-body-card empty-mini">ボディ未選択</div>';
    const skillHtml = renderSkillCard(anim, role, state);
    const bodyFirst = role === 'p1';
    const hpDelta = previousState ? player.hp - previousState.players[role].hp : 0;
    const hpAnimClass = hpDelta < 0 ? 'hp-hit' : hpDelta > 0 ? 'hp-heal' : '';

    return `
      <div class="spectator-player ${role}">
        <div class="spectator-head">
          <div>
            <div class="spectator-name">${window.AM.escapeHtml(player.name || (role === 'p1' ? 'プレイヤー1' : 'プレイヤー2'))}</div>
            <div class="spectator-meta">HP ${player.hp} / 100 ・ ${player.gold}G</div>
          </div>
        </div>
        <div class="hp-row ${hpAnimClass}">
          <div class="hp-bar thick"><div class="hp-fill" style="width:${percent}%"></div></div>
          <div class="hp-number">${player.hp}</div>
        </div>
        <div class="effects-row">${window.AM.createEffectBadges(player)}</div>
        <div class="spectator-card-row ${bodyFirst ? 'body-first' : 'skill-first'}">
          ${bodyFirst ? bodyHtml + skillHtml : skillHtml + bodyHtml}
        </div>
      </div>`;
  }

  function renderTurnSummary(state) {
    const summary = state.turnSummary;
    turnChip.textContent = `ターン ${summary ? summary.turn : state.turn}`;
    firstChip.textContent = `先行: ${summary && summary.firstPlayerName ? summary.firstPlayerName : '未定'}`;
    if (!summary) {
      turnEvents.innerHTML = `<div class="turn-event-card empty-note">ターン実行後、このターンの結果がここに表示されます。</div>`;
      return;
    }
    const entries = (summary.entries || []).map((entry) => {
      const delta = summary.hpDelta ? summary.hpDelta[entry.role] : 0;
      const deltaLabel = delta < 0 ? `${Math.abs(delta)}ダメージ` : delta > 0 ? `+${delta}回復` : `変動なし`;
      const deltaClass = delta < 0 ? 'damage' : delta > 0 ? 'heal' : 'neutral';
      return `
        <div class="turn-event-card ${deltaClass}">
          <div class="event-name">${window.AM.escapeHtml(entry.name)}</div>
          <div class="event-action">${window.AM.escapeHtml(entry.actionLabel || '行動なし')}</div>
          <div class="event-result">${window.AM.escapeHtml(deltaLabel)}</div>
        </div>`;
    }).join('');
    turnEvents.innerHTML = entries + `<div class="turn-highlight-box">${(summary.highlights || []).map((line) => `<p>${window.AM.escapeHtml(line)}</p>`).join('')}</div>`;
  }

  function renderRulesOverlay(state) {
    if (!state.pendingSpectatorRules) {
      rulesOverlay.classList.add("hidden");
      return;
    }
    rulesOverlay.classList.remove("hidden");
    rulesOverlay.innerHTML = `<div class="overlay-box"><h3>バトルルール</h3><ul>${window.AM_DATA.rulesText.map((line) => `<li>${window.AM.escapeHtml(line)}</li>`).join('')}</ul></div>`;
  }

  function render(state) {
    stateTop.innerHTML = `
      <div class="phase-chip">ルーム: ${window.AM.escapeHtml(state.roomCode)}</div>
      <div class="phase-chip">フェーズ: ${window.AM.escapeHtml(state.phase)}</div>
      <div class="phase-chip">ターン: ${state.turn}</div>
      <div class="phase-chip">勝者: ${state.winner === 'draw' ? '引き分け' : state.winner ? window.AM.escapeHtml(state.players[state.winner].name) : '未決着'}</div>`;
    renderTurnSummary(state);
    leftPane.innerHTML = renderPlayer(state, "p1");
    rightPane.innerHTML = renderPlayer(state, "p2");
    logList.innerHTML = (state.battleLog || []).slice(0, 12).map((line) => `<li>${window.AM.escapeHtml(line)}</li>`).join("");
    renderRulesOverlay(state);
    previousState = JSON.parse(JSON.stringify(state));
  }

  let unsubscribe = window.AM.subscribeState(currentRoom, render);
  roomInput.addEventListener("change", () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    previousState = null;
    unsubscribe();
    unsubscribe = window.AM.subscribeState(currentRoom, render);
    render(getState());
  });
  render(getState());
})();
