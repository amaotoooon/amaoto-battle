(function () {
  const roomInput = document.getElementById("master-room-code");
  const createBtn = document.getElementById("create-room");
  const startBtn = document.getElementById("start-match");
  const resolveBtn = document.getElementById("resolve-turn");
  const resetBtn = document.getElementById("reset-match");
  const rulesBtn = document.querySelectorAll("[data-open-rules]");
  const showRulesBtn = document.getElementById("show-spectator-rules");
  const stateSummary = document.getElementById("state-summary");
  const actionStatus = document.getElementById("action-status");
  const playerColumns = document.getElementById("player-columns");
  const battleLog = document.getElementById("master-log");
  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;

  rulesBtn.forEach((btn) => btn.addEventListener("click", () => window.AM.openRulesModal()));
  function getState() { return window.AM.loadState(currentRoom); }
  function createRoom() { currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM; window.AM.resetRoom(currentRoom); }
  function startMatch() { try { window.AM.updateState(currentRoom, (state) => window.AM_BATTLE.startMatch(state)); } catch (e) { alert(e.message); } }
  function resolveTurn() { try { window.AM.updateState(currentRoom, (state) => window.AM_BATTLE.resolveTurn(state)); } catch (e) { alert(e.message); } }
  function resetMatch() { if (confirm("ルーム状態を最初からリセットしますか？")) createRoom(); }
  function toggleSpectatorRules() { window.AM.updateState(currentRoom, (state) => { state.pendingSpectatorRules = !state.pendingSpectatorRules; }); }

  function renderPlayerColumn(state, role) {
    const player = state.players[role];
    const body = window.AM.findBody(player.bodyId);
    const cards = (player.selectedCards || []).map((id) => window.AM.findCard(id)).filter(Boolean);
    return `
      <div class="master-player-card">
        <h3>${window.AM.escapeHtml(player.name || (role === "p1" ? "プレイヤー1" : "プレイヤー2"))}</h3>
        <p>参加: ${player.joined ? '済み' : '未参加'} ・ 所持金: ${player.gold}G</p>
        <p>HP: ${player.hp} ・ 通常回復残り: ${Math.max(0, 2 - player.normalHealUsed)} ・ 瀕死回復: ${player.emergencyHealUsed ? '使用済み' : '未使用'}</p>
        ${body ? `<div class="mini-body">${window.AM.createBodyHTML(body, false)}</div>` : `<p>ボディ未選択</p>`}
        <div class="effects-row">${window.AM.createEffectBadges(player)}</div>
        <div class="master-subtitle">デッキ</div>
        <div class="master-deck">${cards.map((card) => window.AM.createCardHTML(card, player.usedSkills.includes(card.skillKey) ? '使用済み' : '未使用')).join("") || '<div class="empty-note">未登録</div>'}</div>
      </div>
    `;
  }

  function render(state) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    actionStatus.innerHTML = `
      <div class="action-status-chip ${p1.actionLocked ? 'is-ready' : 'is-waiting'}">
        <span class="label">${window.AM.escapeHtml(p1.name || 'プレイヤー1')}</span>
        <span class="value">${p1.actionLocked ? '入力済み' : '未入力'}</span>
      </div>
      <div class="action-status-chip turn-chip">ターン ${state.turn}</div>
      <div class="action-status-chip ${p2.actionLocked ? 'is-ready' : 'is-waiting'}">
        <span class="label">${window.AM.escapeHtml(p2.name || 'プレイヤー2')}</span>
        <span class="value">${p2.actionLocked ? '入力済み' : '未入力'}</span>
      </div>
    `;
    stateSummary.innerHTML = `
      <div class="phase-chip">ルーム: ${window.AM.escapeHtml(state.roomCode)}</div>
      <div class="phase-chip">フェーズ: ${window.AM.escapeHtml(state.phase)}</div>
      <div class="phase-chip">観戦ルール表示: ${state.pendingSpectatorRules ? 'ON' : 'OFF'}</div>
      <div class="phase-chip">勝者: ${state.winner === 'draw' ? '引き分け' : state.winner ? window.AM.escapeHtml(state.players[state.winner].name) : '未決着'}</div>
    `;
    playerColumns.innerHTML = renderPlayerColumn(state, "p1") + renderPlayerColumn(state, "p2");
    battleLog.innerHTML = (state.battleLog || []).map((line) => `<li>${window.AM.escapeHtml(line)}</li>`).join("");
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
  resolveBtn.addEventListener("click", resolveTurn);
  resetBtn.addEventListener("click", resetMatch);
  showRulesBtn.addEventListener("click", toggleSpectatorRules);
  render(getState());
})();
