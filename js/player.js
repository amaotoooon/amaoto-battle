(function () {
  const roomInput = document.getElementById("room-code");
  const roleSelect = document.getElementById("player-role");
  const nameInput = document.getElementById("player-name");
  const saveBtn = document.getElementById("save-entry");
  const bodyGrid = document.getElementById("body-grid");
  const selectedDeck = document.getElementById("selected-deck");
  const deckCount = document.getElementById("deck-count");
  const twicaBox = document.getElementById("twica-box");
  const phaseBox = document.getElementById("phase-box");
  const actionPanel = document.getElementById("action-panel");
  const statusBox = document.getElementById("status-box");
  const skillPanel = document.getElementById("skill-panel");
  const ruleButtons = document.querySelectorAll("[data-open-rules]");
  const joinNotice = document.getElementById("join-notice");
  const previewGrid = document.getElementById("card-preview-grid");
  const cardSelects = [1, 2, 3].map((n) => document.getElementById(`card-select-${n}`));

  let currentRoom = roomInput.value || window.AM.DEFAULT_ROOM;
  let selectedBodyId = "";
  let selectedCards = ["", "", ""];
  let draftDirty = false;

  function draftKey(roomCode, role) {
    return `amaoto_battle_draft__${roomCode || window.AM.DEFAULT_ROOM}__${role || 'p1'}`;
  }
  function normalizeSelectedCards(list) {
    const arr = Array.isArray(list) ? list.filter(Boolean).slice(0, 3) : [];
    while (arr.length < 3) arr.push("");
    return arr;
  }
  function getChosenCards() { return selectedCards.filter(Boolean); }
  function loadDraft(roomCode, role) {
    try {
      const raw = localStorage.getItem(draftKey(roomCode, role));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }
  function saveDraft(roomCode, role) {
    const draft = {
      name: nameInput.value.trim(),
      bodyId: selectedBodyId || "",
      selectedCards: [...selectedCards],
      updatedAt: Date.now()
    };
    localStorage.setItem(draftKey(roomCode, role), JSON.stringify(draft));
  }
  function clearDraft(roomCode, role) { localStorage.removeItem(draftKey(roomCode, role)); }
  function markDraftDirty() {
    draftDirty = true;
    saveDraft(currentRoom, getRole());
  }

  twicaBox.innerHTML = (window.AM_DATA.twicaText || []).map((line) => `<p>${window.AM.escapeHtml(line)}</p>`).join("");
  ruleButtons.forEach((btn) => btn.addEventListener("click", () => window.AM.openRulesModal()));

  function getRole() { return roleSelect.value || "p1"; }
  function currentState() { return window.AM.loadState(currentRoom); }

  function syncSelectionsFromState(state) {
    const role = getRole();
    const player = state.players[role];
    const draft = loadDraft(currentRoom, role);
    const hasSavedDeck = !!(player.joined && player.bodyId && (player.selectedCards || []).filter(Boolean).length === 3);

    if (hasSavedDeck) {
      selectedBodyId = player.bodyId || "";
      selectedCards = normalizeSelectedCards(player.selectedCards || []);
      draftDirty = false;
      clearDraft(currentRoom, role);
      if (player.name) nameInput.value = player.name;
      return;
    }
    if (draftDirty && draft) {
      selectedBodyId = draft.bodyId || selectedBodyId;
      selectedCards = normalizeSelectedCards(draft.selectedCards || selectedCards);
      if (draft.name) nameInput.value = draft.name;
      return;
    }
    if (draft && !hasSavedDeck) {
      selectedBodyId = draft.bodyId || "";
      selectedCards = normalizeSelectedCards(draft.selectedCards || []);
      if (draft.name) nameInput.value = draft.name;
      return;
    }
    selectedBodyId = player.bodyId || "";
    selectedCards = normalizeSelectedCards(player.selectedCards || []);
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
        markDraftDirty();
        renderBodyGrid();
      });
    });
  }

  function renderCardSelects() {
    const chosen = getChosenCards();
    const options = window.AM_DATA.cards.map((card) => ({ value: card.cardId, label: `${card.cardName} / ${card.skillName}` }));
    cardSelects.forEach((select, idx) => {
      const current = selectedCards[idx] || "";
      select.innerHTML = [`<option value="">選択してください</option>`]
        .concat(options.map((opt) => {
          const alreadyUsed = chosen.includes(opt.value) && opt.value !== current;
          return `<option value="${opt.value}" ${opt.value === current ? 'selected' : ''} ${alreadyUsed ? 'disabled' : ''}>${window.AM.escapeHtml(opt.label)}</option>`;
        }))
        .join("");
      select.onchange = () => {
        selectedCards[idx] = select.value || "";
        selectedCards = normalizeSelectedCards(selectedCards);
        markDraftDirty();
        renderCardSelects();
        renderSelectedDeck();
      };
    });
  }

  function renderCardPreviews() {
    previewGrid.innerHTML = selectedCards.map((id, idx) => {
      const card = id ? window.AM.findCard(id) : null;
      if (!card) {
        return `<div class="preview-slot empty-note">スキルカード${idx + 1} を選んでください。</div>`;
      }
      return `<div class="preview-slot">${window.AM.createCardHTML(card)}</div>`;
    }).join("");
  }

  function renderSelectedDeck() {
    const cards = getChosenCards().map((id) => window.AM.findCard(id)).filter(Boolean);
    deckCount.textContent = String(cards.length);
    selectedDeck.innerHTML = cards.length ? cards.map((card) => window.AM.createCardHTML(card)).join("") : `<div class="empty-note">まだカードを選んでいません。</div>`;
    renderCardPreviews();
  }

  function saveEntry() {
    const roomCode = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    const name = nameInput.value.trim();
    const role = getRole();
    const chosen = getChosenCards();
    if (!name) return alert("プレイヤー名を入力してください。");
    if (!selectedBodyId) return alert("ボディを1枚選んでください。");
    if (chosen.length !== 3) return alert("スキルカードを3枚選んでください。");

    currentRoom = roomCode;
    window.AM.updateState(currentRoom, (state) => {
      const player = state.players[role];
      player.joined = true;
      player.name = name;
      player.bodyId = selectedBodyId;
      player.selectedCards = [...chosen];
      if (state.phase === "lobby") player.hp = 100;
    });
    draftDirty = false;
    saveDraft(currentRoom, role);
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
    const sourceIds = (player.joined && player.selectedCards && player.selectedCards.length === 3) ? player.selectedCards : getChosenCards();
    const usedSkills = player.usedSkills || [];
    const cards = (sourceIds || []).map((id) => window.AM.findCard(id)).filter(Boolean);
    skillPanel.innerHTML = cards.map((card) => {
      const used = usedSkills.includes(card.skillKey);
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
    const skillButtons = (player.selectedCards || []).map((id) => window.AM.findCard(id)).filter(Boolean).map((card) => {
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
          <button type="button" class="major-action" data-action="attack" data-move="punch">こぶし<br><small>18ダメージ</small></button>
          <button type="button" class="major-action" data-action="attack" data-move="kick">足蹴り<br><small>24ダメージ</small></button>
          <button type="button" class="major-action" data-action="attack" data-move="throw">背負い投げ<br><small>32ダメージ</small></button>
        </div>
        <div class="action-group">
          <h3>守る・回復</h3>
          <button type="button" class="major-action" data-action="guard">ガード<br><small>被ダメージ半減</small></button>
          <button type="button" class="major-action" data-action="heal" data-mode="normal">回復する<br><small>HP20回復</small></button>
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
        if (type === "attack") lockAction({ type, move: btn.getAttribute("data-move") });
        if (type === "guard") lockAction({ type });
        if (type === "heal") lockAction({ type, mode: btn.getAttribute("data-mode") });
      });
    });
    actionPanel.querySelectorAll("[data-skill-key]").forEach((btn) => {
      btn.addEventListener("click", () => lockAction({ type: "skill", skillKey: btn.getAttribute("data-skill-key") }));
    });
  }

  function renderPhase(state) {
    const role = getRole();
    const player = state.players[role];
    phaseBox.innerHTML = `
      <span class="phase-chip">フェーズ: ${window.AM.escapeHtml(state.phase)}</span>
      <span class="phase-chip">ターン: ${state.turn}</span>
      <span class="phase-chip">自分: ${window.AM.escapeHtml(player.name || '未登録')}</span>
      <span class="phase-chip">行動: ${player.actionLocked ? '確定済み' : '未確定'}</span>`;
    joinNotice.textContent = player.joined ? '参加登録は保存済みです。' : 'まだ保存前です。';
  }

  function render(state) {
    syncSelectionsFromState(state);
    renderBodyGrid();
    renderCardSelects();
    renderSelectedDeck();
    renderPlayerStatus(state);
    renderSkillPanel(state);
    renderActionPanel(state);
    renderPhase(state);
  }

  saveBtn.addEventListener("click", saveEntry);
  roomInput.addEventListener("change", () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    draftDirty = false;
    const draft = loadDraft(currentRoom, getRole());
    if (draft) {
      nameInput.value = draft.name || nameInput.value;
      selectedBodyId = draft.bodyId || "";
      selectedCards = normalizeSelectedCards(draft.selectedCards || []);
      draftDirty = true;
      render(currentState());
    }
  });
  roleSelect.addEventListener("change", () => {
    const draft = loadDraft(currentRoom, getRole());
    if (draft) {
      nameInput.value = draft.name || "";
      selectedBodyId = draft.bodyId || "";
      selectedCards = normalizeSelectedCards(draft.selectedCards || []);
      draftDirty = true;
    } else {
      const state = currentState();
      syncSelectionsFromState(state);
    }
    render(currentState());
  });

  window.AM.subscribeState(currentRoom, render);
  render(currentState());
})();
