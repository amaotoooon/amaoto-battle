(function () {
  const roomInput = document.getElementById("spectator-room-code");
  const leftPane = document.getElementById("spectator-left");
  const rightPane = document.getElementById("spectator-right");
  const rulesOverlay = document.getElementById("spectator-rules");
  const openRulesButtons = document.querySelectorAll("[data-open-rules]");
  const phaseBanner = document.getElementById("phase-banner");
  const turnEvents = document.getElementById("turn-events");
  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  let previousState = null;

  openRulesButtons.forEach((btn) => btn.addEventListener("click", () => window.AM.openRulesModal()));
  function getState() { return window.AM.loadState(currentRoom); }

  function phaseLabel(state) {
    if (state.phase === "lobby") return "対戦開始前";
    if (state.phase === "finished") return "対戦終了";
    const summaryTurn = state.turnSummary?.turn || Math.max(1, state.turn);
    return `ターン${summaryTurn}`;
  }

  function renderSkillCard(anim) {
    if (!anim) {
      return `<div class="mini-skill-card empty-mini single-line">このターンのスキル発動なし</div>`;
    }
    const effectType = window.AM.escapeHtml(anim.effectType || '特殊');
    return `
      <div class="mini-skill-card effect-${effectType}">
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
    const shieldPercent = Math.max(0, Math.min(Math.max(0, 100 - percent), player.shield || 0));
    const anim = (state.lastAnimations || {})[role];
    const bodyHtml = body
      ? `<div class="mini-body-card"><img src="${window.AM.escapeHtml(body.imagePath)}" alt="${window.AM.escapeHtml(body.bodyName)}" class="spectator-body-image" /><div class="mini-body-name">${window.AM.escapeHtml(body.bodyName)}</div></div>`
      : '<div class="mini-body-card empty-mini">ボディ未選択</div>';
    const skillHtml = renderSkillCard(anim);
    const hpDelta = previousState ? player.hp - previousState.players[role].hp : 0;
    const hpAnimClass = hpDelta < 0 ? 'hp-hit' : hpDelta > 0 ? 'hp-heal' : '';
    const summary = state.turnSummary || {};
    const roleLabel = summary.firstPlayerRole ? (summary.firstPlayerRole === role ? "先攻" : "後攻") : "待機";
    const winnerClass = state.phase === 'finished' ? (state.winner === role ? 'winner-side' : 'loser-side') : '';
    const winnerBadge = state.phase === 'finished' ? (state.winner === role ? '<div class="result-badge winner">WINNER</div>' : '<div class="result-badge loser">LOSER</div>') : '';
    const playerIcon = role === 'p1' ? 'assets/images/ui/icon_player_left.png' : 'assets/images/ui/icon_player_right.png';
    const heart = 'assets/images/ui/icon_heart.png';
    const defaultName = role === 'p1' ? 'プレイヤー1' : 'プレイヤー2';
    const messageHtml = player.message ? `<span class="inline-message">「${window.AM.escapeHtml(player.message)}」</span>` : '';

    return `
      <div class="spectator-player ${role} ${winnerClass}">
        ${winnerBadge}
        <div class="spectator-head">
          <div>
            <div class="spectator-name-row">
              <img src="${playerIcon}" alt="" class="player-side-icon" />
              <div class="spectator-name">${window.AM.escapeHtml(player.name || defaultName)}</div>
              <div class="attack-order-badge">${roleLabel}</div>
              ${messageHtml}
            </div>
            <div class="spectator-meta">所持金 ${player.gold}G</div>
          </div>
        </div>
        <div class="hp-row ${hpAnimClass}">
          <img src="${heart}" alt="" class="hp-heart" />
          <div class="hp-bar-wrap">
            <div class="hp-bar thick">
              <div class="hp-fill" style="width:${percent}%"></div>
              ${shieldPercent > 0 ? `<div class="shield-fill" style="left:${percent}%;width:${shieldPercent}%"></div>` : ''}
            </div>
          </div>
          <div class="hp-number">${player.hp}</div>
        </div>
        <div class="spectator-card-row">
          ${bodyHtml}
          ${skillHtml}
        </div>
      </div>`;
  }

  function formatAction(entry, delta) {
    if (!entry) return {action:'行動なし', result:'変化なし', note:''};
    let result = '変化なし';
    if (delta < 0) result = `${Math.abs(delta)}ダメージ`;
    if (delta > 0) result = `HP+${delta}`;
    return {
      action: entry.actionLabel || '行動なし',
      result,
      note: entry.note || ''
    };
  }

  function renderTurnSummary(state) {
    phaseBanner.textContent = phaseLabel(state);
    if (!state.turnSummary) {
      turnEvents.innerHTML = `
        <div class="turn-event-card"><div class="event-name">プレイヤー1</div><div class="event-action">まだ行動していません</div><div class="event-result">待機中</div></div>
        <div class="turn-event-card"><div class="event-name">プレイヤー2</div><div class="event-action">まだ行動していません</div><div class="event-result">待機中</div></div>`;
      return;
    }
    const summary = state.turnSummary;
    const left = summary.entries.find((entry) => entry.role === 'p1');
    const right = summary.entries.find((entry) => entry.role === 'p2');
    const leftView = formatAction(left, summary.hpDelta?.p1 || 0);
    const rightView = formatAction(right, summary.hpDelta?.p2 || 0);
    const renderCard = (entry, view) => `\n      <div class="turn-event-card ${view.result.includes('ダメージ') ? 'damage' : view.result.includes('HP+') ? 'heal' : 'neutral'}">\n        <div class="event-name">${window.AM.escapeHtml(entry?.name || '')}</div>\n        <div class="event-action">${window.AM.escapeHtml(view.action)}</div>\n        <div class="event-result">${window.AM.escapeHtml(view.result)}</div>\n        ${view.note ? `<div class="event-note">${window.AM.escapeHtml(view.note)}</div>` : `<div class="event-note empty-note-line">&nbsp;</div>`}\n      </div>`;
    turnEvents.innerHTML = renderCard(left, leftView) + renderCard(right, rightView);
  }

  function renderRulesOverlay(state) {
    if (!state.pendingSpectatorRules) {
      rulesOverlay.classList.add('hidden');
      return;
    }
    rulesOverlay.classList.remove('hidden');
    rulesOverlay.innerHTML = `<div class="overlay-box"><h3>バトルルール</h3><ul>${window.AM_DATA.rulesText.map((line) => `<li>${window.AM.escapeHtml(line)}</li>`).join('')}</ul></div>`;
  }

  function render(state) {
    renderTurnSummary(state);
    leftPane.innerHTML = renderPlayer(state, 'p1');
    rightPane.innerHTML = renderPlayer(state, 'p2');
    renderRulesOverlay(state);
    previousState = JSON.parse(JSON.stringify(state));
  }

  let unsubscribe = window.AM.subscribeState(currentRoom, render);
  roomInput.addEventListener('change', () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    previousState = null;
    unsubscribe();
    unsubscribe = window.AM.subscribeState(currentRoom, render);
    render(getState());
  });
  render(getState());
})();
