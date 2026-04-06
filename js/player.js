(function () {
  const roomInput = document.getElementById("room-code");
  const roleSelect = document.getElementById("player-role");
  const nameInput = document.getElementById("player-name");
  const saveBtn = document.getElementById("save-entry");
  const bodyGrid = document.getElementById("body-grid");
  const cardGrid = document.getElementById("card-grid");
  const selectedDeck = document.getElementById("selected-deck");
  const deckCount = document.getElementById("deck-count");
  const twicaBox = document.getElementById("twica-box");
  const phaseBox = document.getElementById("phase-box");
  const actionPanel = document.getElementById("action-panel");
  const statusBox = document.getElementById("status-box");
  const skillPanel = document.getElementById("skill-panel");
  const ruleButtons = document.querySelectorAll("[data-open-rules]");
  const joinNotice = document.getElementById("join-notice");

  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  let selectedBodyId = "";
  let selectedCards = [];

  twicaBox.innerHTML = (window.AM_DATA.twicaText || []).map((line) => `<p>${window.AM.escapeHtml(line)}</p>`).join("");
  ruleButtons.forEach((btn) => btn.addEventListener("click", () => window.AM.openRulesModal()));

  function getRole() { return roleSelect.value || "p1"; }
  function currentState() { return window.AM.loadState(currentRoom); }

  function syncSelectionsFromState(state) {
    const player = state.players[getRole()];
    selectedBodyId = player.bodyId || "";
    selectedCards = [...(player.selectedCards || [])];
  }

  function renderBodyGrid() {
    bodyGrid.innerHTML = window.AM_DATA.bodies.map((body) => `
      <button type="button" class="body-button ${selectedBodyId === body.bodyId ? 'selected' : ''}" data-body-id="${body.bodyId}">
        ${window.AM.createBodyHTML(body, selectedBodyId === body.bodyId)}
      </button>
    `).join("");
    bodyGrid.querySelectorAll("[data-body-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedBodyId = btn.getAttribute("data-body-id");
        renderBodyGrid();
      });
    });
  }

  function renderCardGrid() {
    cardGrid.innerHTML = window.AM_DATA.cards.map((card) => {
      const selected = selectedCards.includes(card.cardId);
      return `
        <button type="button" class="card-button ${selected ? 'selected' : ''}" data-card-id="${card.cardId}">
          ${window.AM.createCardHTML(card, '')}
        </button>
      `;
    }).join("");
    cardGrid.querySelectorAll("[data-card-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cardId = btn.getAttribute("data-card-id");
        if (selectedCards.includes(cardId)) {
          selectedCards = selectedCards.filter((id) => id !== cardId);
        } else if (selectedCards.length < 3) {
          selectedCards.push(cardId);
        } else {
          alert("スキルカードは3枚までです。");
        }
        renderCardGrid();
        renderSelectedDeck();
      });
    });
  }

  function renderSelectedDeck() {
    deckCount.textContent = String(selectedCards.length);
    const cards = selectedCards.map((id) => window.AM.findCard(id)).filter(Boolean);
    selectedDeck.innerHTML = cards.length ? cards.map((card) => window.AM.createCardHTML(card)).join("") : `<div class="empty-note">まだカードを選んでいません。</div>`;
  }

  function saveEntry() {
    const roomCode = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    const name = nameInput.value.trim();
    const role = getRole();
    if (!name) return alert("プレイヤー名を入力してください。");
    if (!selectedBodyId) return alert("ボディを1枚選んでください。");
    if (selectedCards.length !== 3) return alert("スキルカードを3枚選んでください。");

    currentRoom = roomCode;
    window.AM.updateState(currentRoom, (state) => {
      const player = state.players[role];
      player.joined = true;
      player.name = name;
      player.bodyId = selectedBodyId;
      player.selectedCards = [...selectedCards];
      if (state.phase === "lobby") player.hp = 100;
    });
  }

  function renderPlayerStatus(state) {
    const player = state.players[getRole()];
    const opponent = state.players[window.AM.getOpponentRole(getRole())];
    statusBox.innerHTML = `
      <div class="status-card">
        <h3>${window.AM.escapeHtml(player.name || '未登録')}</h3>
        <p>所持金: ${player.gold}G</p>
        <p>HP: ${player.hp}</p>
        <p>通常回復: ${Math.max(0, 2 - player.normalHealUsed)}回</p>
        <p>瀕死回復: ${player.emergencyHealUsed ? '使用済み' : '未使用'}</p>
        <div class="effects-row">${window.AM.createEffectBadges(player)}</div>
      </div>
      <div class="status-card">
        <h3>相手</h3>
        <p>${window.AM.escapeHtml(opponent.name || '未参加')}</p>
        <p>HP: ${opponent.hp}</p>
        <div class="effects-row">${window.AM.createEffectBadges(opponent)}</div>
      </div>
    `;
  }

  function renderSkillPanel(state) {
    const player = state.players[getRole()];
    const cards = (player.selectedCards || []).map((id) => window.AM.findCard(id)).filter(Boolean);
    skillPanel.innerHTML = cards.map((card) => {
      const used = player.usedSkills.includes(card.skillKey);
      return `<div class="skill-slot ${used ? 'used' : ''}">${window.AM.createCardHTML(card, used ? '使用済み' : '未使用')}</div>`;
    }).join("") || `<div class="empty-note">スキルカード未登録</div>`;
  }

  function lockAction(action) {
    const state = currentState();
    const player = state.players[getRole()];
    if (state.phase !== "battle") return alert("まだ対戦開始前です。");
    if (!player.joined) return alert("先に参加登録を保存してください。");
    window.AM.updateState(currentRoom, (next) => {
      const me = next.players[getRole()];
      me.submittedAction = action;
      me.actionLocked = true;
      next.lastActor = me.name;
      next.battleLog.unshift(`${me.name}が行動を確定しました。`);
    });
  }

  function renderActionPanel(state) {
    const player = state.players[getRole()];
    if (state.phase === "finished") {
      actionPanel.innerHTML = `<div class="empty-note">試合終了です。</div>`;
      return;
    }
    if (state.phase !== "battle") {
      actionPanel.innerHTML = `<div class="empty-note">対戦開始後に行動を選べます。</div>`;
      return;
    }
    const skillButtons = player.selectedCards.map((id) => window.AM.findCard(id)).filter(Boolean).map((card) => {
      const disabled = player.usedSkills.includes(card.skillKey);
      return `
        <button type="button" class="minor-action ${disabled ? 'disabled' : ''}" ${disabled ? 'disabled' : ''} data-skill-key="${card.skillKey}">
          ${window.AM.escapeHtml(card.skillName)}<br><small>${window.AM.escapeHtml(card.effectShort)}</small>
        </button>`;
    }).join("");

    actionPanel.innerHTML = `
      <div class="action-grid">
        <div class="action-group">
          <h3>たたかう</h3>
          <button type="button" class="major-action" data-action="attack" data-move="punch">こぶし<br><small>14ダメージ</small></button>
          <button type="button" class="major-action" data-action="attack" data-move="kick">足蹴り<br><small>18ダメージ</small></button>
          <button type="button" class="major-action" data-action="attack" data-move="throw">背負い投げ<br><small>24ダメージ</small></button>
        </div>
        <div class="action-group">
          <h3>守る・回復</h3>
          <button type="button" class="major-action" data-action="guard">ガード<br><small>被ダメージ半減</small></button>
          <button type="button" class="major-action" data-action="heal" data-mode="normal">回復する<br><small>HP25回復</small></button>
          <button type="button" class="major-action" data-action="heal" data-mode="emergency">瀕死回復<br><small>HP15以下で80まで回復</small></button>
        </div>
      </div>
      <div class="action-group">
        <h3>スキル発動</h3>
        <div class="minor-actions">${skillButtons}</div>
      </div>
      <div class="submit-note">${player.actionLocked ? '行動は確定済みです。マスターの解決をお待ちください。' : '行動を1つ選ぶと即時確定されます。'}</div>
    `;
    actionPanel.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-action");
        if (type === "attack") lockAction({ type: "attack", move: btn.getAttribute("data-move") });
        else if (type === "guard") lockAction({ type: "guard" });
        else if (type === "heal") lockAction({ type: "heal", mode: btn.getAttribute("data-mode") });
      });
    });
    actionPanel.querySelectorAll("[data-skill-key]").forEach((btn) => {
      btn.addEventListener("click", () => lockAction({ type: "skill", skillKey: btn.getAttribute("data-skill-key") }));
    });
  }

  function renderPhase(state) {
    const me = state.players[getRole()];
    const status = me.joined ? "参加登録済み" : "未参加";
    phaseBox.innerHTML = `
      <div class="phase-chip">現在フェーズ: ${window.AM.escapeHtml(state.phase)}</div>
      <div class="phase-chip">ルーム: ${window.AM.escapeHtml(state.roomCode)}</div>
      <div class="phase-chip">ターン: ${state.turn}</div>
      <div class="phase-chip">あなた: ${status}</div>
      <div class="phase-chip">行動: ${me.actionLocked ? '入力済み' : '未入力'}</div>
    `;
    joinNotice.textContent = me.actionLocked ? "行動確定済みです。" : "参加内容を保存したあと、対戦中は上部から行動できます。";
  }

  function render(state) {
    syncSelectionsFromState(state);
    nameInput.value = state.players[getRole()].name || nameInput.value;
    renderBodyGrid();
    renderCardGrid();
    renderSelectedDeck();
    renderPhase(state);
    renderPlayerStatus(state);
    renderSkillPanel(state);
    renderActionPanel(state);
  }

  roleSelect.addEventListener("change", () => render(currentState()));
  let unsubscribe = window.AM.subscribeState(currentRoom, render);
  roomInput.addEventListener("change", () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    unsubscribe();
    unsubscribe = window.AM.subscribeState(currentRoom, render);
    render(currentState());
  });
  saveBtn.addEventListener("click", saveEntry);
  render(currentState());
})();
