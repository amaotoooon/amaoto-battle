(function () {
  const roomInput = document.getElementById("spectator-room-code");
  const stateTop = document.getElementById("spectator-state");
  const leftPane = document.getElementById("spectator-left");
  const rightPane = document.getElementById("spectator-right");
  const centerStage = document.getElementById("center-stage");
  const logList = document.getElementById("spectator-log");
  const rulesOverlay = document.getElementById("spectator-rules");
  const openRulesButtons = document.querySelectorAll("[data-open-rules]");
  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  openRulesButtons.forEach((btn) => btn.addEventListener("click", () => window.AM.openRulesModal()));
  function getState() { return window.AM.loadState(currentRoom); }

  function renderAnimCard(anim, label) {
    if (!anim) {
      return `<div class="spectator-skill-shell"><div class="spectator-skill-label">${label}</div><div class="empty-note">このターンのスキル発動はありません。</div></div>`;
    }
    return `
      <div class="spectator-skill-shell">
        <div class="spectator-skill-label">${label}</div>
        <div class="anim-card effect-${window.AM.escapeHtml(anim.effectType || '特殊')}">
          ${anim.imagePath ? `<img src="${window.AM.escapeHtml(anim.imagePath)}" alt="${window.AM.escapeHtml(anim.cardName)}" class="anim-image" />` : ''}
          <div class="anim-title">${window.AM.escapeHtml(anim.cardName)}</div>
          <div class="anim-skill">${window.AM.escapeHtml(anim.skillName)}</div>
          <div class="anim-effect">${window.AM.escapeHtml(anim.effectShort)}</div>
        </div>
      </div>`;
  }

  function renderPlayer(state, role) {
    const player = state.players[role];
    const body = window.AM.findBody(player.bodyId);
    const percent = Math.max(0, Math.min(100, player.hp));
    const anim = (state.lastAnimations || {})[role];
    const bodyFirst = role === 'p1';
    const bodyHtml = body
      ? `<div class="spectator-card-block body-block"><div class="spectator-card-label">ボディ</div><img src="${window.AM.escapeHtml(body.imagePath)}" alt="${window.AM.escapeHtml(body.bodyName)}" class="spectator-body-image" /></div>`
      : '<div class="spectator-card-block body-block"><div class="empty-note">ボディ未選択</div></div>';
    const skillHtml = `<div class="spectator-card-block skill-block">${renderAnimCard(anim, 'このターンの発動スキル')}</div>`;
    return `
      <div class="spectator-player ${role}">
        <div class="spectator-name">${window.AM.escapeHtml(player.name || (role === 'p1' ? 'プレイヤー1' : 'プレイヤー2'))}</div>
        <div class="hp-bar"><div class="hp-fill" style="width:${percent}%"></div></div>
        <div class="spectator-meta">HP ${player.hp} / 100 ・ ${player.gold}G</div>
        <div class="effects-row">${window.AM.createEffectBadges(player)}</div>
        <div class="spectator-card-row ${bodyFirst ? 'body-first' : 'skill-first'}">
          ${bodyFirst ? bodyHtml + skillHtml : skillHtml + bodyHtml}
        </div>
      </div>`;
  }

  function renderCenter(state) {
    centerStage.innerHTML = `
      <div class="center-summary compact-summary">
        <div class="phase-chip">ターン ${state.turn}</div>
        <p>対戦内容は下のバトルログに表示されます。</p>
      </div>`;
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
    leftPane.innerHTML = renderPlayer(state, "p1");
    rightPane.innerHTML = renderPlayer(state, "p2");
    renderCenter(state);
    logList.innerHTML = (state.battleLog || []).slice(0, 12).map((line) => `<li>${window.AM.escapeHtml(line)}</li>`).join("");
    renderRulesOverlay(state);
  }

  let unsubscribe = window.AM.subscribeState(currentRoom, render);
  roomInput.addEventListener("change", () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    unsubscribe();
    unsubscribe = window.AM.subscribeState(currentRoom, render);
    render(getState());
  });
  render(getState());
})();
