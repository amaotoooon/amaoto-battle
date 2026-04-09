(function () {
  const introStage = document.getElementById('intro-stage');
  const identityStage = document.getElementById('identity-stage');
  const roomStage = document.getElementById('room-stage');
  const setupStage = document.getElementById('setup-stage');
  const battleStage = document.getElementById('battle-stage');
  const flowHeader = document.getElementById('flow-header');
  const startEntryBtn = document.getElementById('start-entry');
  const goRoomBtn = document.getElementById('go-room');
  const saveEntryBtn = document.getElementById('save-entry');
  const saveSetupBtn = document.getElementById('save-setup');
  const roomInput = document.getElementById('room-code');
  const roleSelect = document.getElementById('player-role');
  const nameInput = document.getElementById('player-name');
  const goldInput = document.getElementById('player-gold');
  const betInput = document.getElementById('player-bet');
  const bodyGrid = document.getElementById('body-grid');
  const deckCount = document.getElementById('deck-count');
  const twicaBox = document.getElementById('twica-box');
  const phaseBox = document.getElementById('phase-box');
  const actionPanel = document.getElementById('action-panel');
  const statusBox = document.getElementById('status-box');
  const logBox = document.getElementById('player-log');
  const entryReviewBox = document.getElementById('entry-review-box');
  const messageInput = document.getElementById('player-message');
  const sendMessageBtn = document.getElementById('send-message');
  const messageStatus = document.getElementById('message-status');
  const joinNotice = document.getElementById('join-notice');
  const setupNotice = document.getElementById('setup-notice');
  const identityNotice = document.getElementById('identity-notice');
  const previewGrid = document.getElementById('card-preview-grid');
  const cardSelects = [1, 2, 3].map((n) => document.getElementById(`card-select-${n}`));
  const toggleButtons = {
    entry: document.getElementById('open-entry-review'),
    status: document.getElementById('open-status-review'),
    log: document.getElementById('open-log-review')
  };
  const togglePanels = {
    entry: document.getElementById('entry-review-panel'),
    status: document.getElementById('status-review-panel'),
    log: document.getElementById('log-review-panel')
  };
  const ruleButtons = document.querySelectorAll('[data-open-rules]');
  const exitButtons = document.querySelectorAll('[data-exit-top]');
  let reviewPanelMode = '';

  let currentRoom = window.AM.DEFAULT_ROOM;
  let selectedBodyId = '';
  let selectedCards = ['', '', ''];
  let pendingAction = null;
  let stage = 'intro';
  let unsubscribe = null;
  let lastRematchToken = 0;

  function setStage(next) {
    stage = next;
    introStage.classList.toggle('hidden', next !== 'intro');
    identityStage.classList.toggle('hidden', next !== 'identity');
    roomStage.classList.toggle('hidden', next !== 'room');
    setupStage.classList.toggle('hidden', next !== 'setup');
    battleStage.classList.toggle('hidden', next !== 'battle');
    if (flowHeader) flowHeader.classList.toggle('hidden', next === 'intro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  setStage('intro');
  lastRematchToken = currentState().rematchToken || 0;

  function getRole() { return roleSelect.value || 'p1'; }
  function currentState() { return window.AM.loadState(currentRoom); }
  function getPlayer(state) { return state.players[getRole()]; }
  function getOpponent(state) { return state.players[window.AM.getOpponentRole(getRole())]; }
  function lockField(el, locked) { if (!el) return; el.disabled = !!locked; }

  function getGoldValue() {
    return Math.max(0, Number(goldInput.value || 0));
  }

  function getAllowedBetMax(gold = getGoldValue()) {
    return Math.max(50, Number(gold || 0));
  }

  function clampBetForGold(bet, gold = getGoldValue()) {
    const maxBet = getAllowedBetMax(gold);
    return Math.min(Math.max(50, Number(bet || 50)), maxBet);
  }

  function refreshBetConstraint(options = {}) {
    const showNotice = !!options.showNotice;
    const gold = getGoldValue();
    const maxBet = getAllowedBetMax(gold);
    const rawBet = Number(betInput.value || 50);
    const nextBet = clampBetForGold(rawBet, gold);

    betInput.min = '50';
    betInput.max = String(maxBet);

    if (!Number.isFinite(rawBet) || rawBet !== nextBet) {
      betInput.value = nextBet;
      if (showNotice) {
        if (gold < 50) setupNotice.textContent = '所持Gが最低BET額(50G)に満たしていない場合は、50Gが上限です。';
        else setupNotice.textContent = `BET額は所持Gまで設定できます。現在の上限は${maxBet}Gです。`;
      }
    }
  }

  function syncSetupStateFromPlayer(player, options = {}) {
    const resetDeck = !!options.resetDeck;
    goldInput.value = Math.max(0, Number(player.gold ?? goldInput.value ?? 1000));
    betInput.value = Number(player.bet ?? betInput.value ?? 50);
    refreshBetConstraint();
    if (resetDeck) {
      selectedBodyId = '';
      selectedCards = ['', '', ''];
    } else {
      selectedBodyId = player.bodyId || selectedBodyId;
      selectedCards = Array.isArray(player.selectedCards) && player.selectedCards.length ? [...player.selectedCards, '', '', ''].slice(0, 3) : selectedCards;
    }
  }

  function handleRematchTransition(state) {
    const player = getPlayer(state);
    pendingAction = null;
    syncSetupStateFromPlayer(player, { resetDeck: true });
    [goldInput, betInput, ...cardSelects].forEach((el) => lockField(el, false));
    renderBodyGrid(false);
    renderCardSelects(false);
    closeReviewPanels();
    setupNotice.textContent = '再戦準備中です。所持Gを確認し、ボディとスキルを選び直してください。';
    setStage('setup');
  }

  goldInput.addEventListener('input', () => refreshBetConstraint({ showNotice: true }));
  betInput.addEventListener('input', () => refreshBetConstraint({ showNotice: true }));

  ruleButtons.forEach((btn) => btn.addEventListener('click', () => window.AM.openRulesModal()));
  exitButtons.forEach((btn)=>btn.addEventListener('click', ()=>{ const msg = stage === 'battle' ? '対戦中ですが、退出してトップページに戻りますか？' : 'トップページに戻りますか？ 現在の入力内容はこの端末では保持されません。'; if(confirm(msg)) { location.reload(); } }));
  startEntryBtn.addEventListener('click', () => setStage('identity'));

  goRoomBtn.addEventListener('click', () => {
    if (!nameInput.value.trim()) {
      identityNotice.textContent = 'プレイヤー名を入力してください。';
      return;
    }
    identityNotice.textContent = '';
    lockField(roleSelect, true);
    lockField(nameInput, true);
    setStage('room');
  });

  saveEntryBtn.addEventListener('click', () => {
    currentRoom = roomInput.value.trim() || window.AM.DEFAULT_ROOM;
    if (unsubscribe) unsubscribe();
    unsubscribe = window.AM.subscribeState(currentRoom, render);
    window.AM.updateState(currentRoom, (state) => {
      const p = state.players[getRole()];
      p.name = nameInput.value.trim().slice(0, 20);
    });
    lockField(roomInput, true);
    joinNotice.textContent = '入室しました。対戦準備を進めてください。';
    syncSetupStateFromPlayer(currentState().players[getRole()], { resetDeck: false });
    setStage('setup');
    render(currentState());
  });

  function renderBodyGrid(locked = false) {
    bodyGrid.innerHTML = (window.AM_DATA.bodies || []).map((body) => {
      const isSelected = selectedBodyId === body.bodyId;
      const classes = ['body-unit', isSelected ? 'selected' : '', locked && !isSelected ? 'muted' : ''].join(' ');
      return `<div class="${classes}" data-body-id="${window.AM.escapeHtml(body.bodyId)}"><img src="${window.AM.escapeHtml(body.imagePath)}" alt="${window.AM.escapeHtml(body.bodyName)}" class="body-image" /><div class="card-body"><div class="body-name">${window.AM.escapeHtml(body.bodyName)}</div><div class="body-meta">HP ${body.hp || 100}</div></div></div>`;
    }).join('');
    if (!locked) bodyGrid.querySelectorAll('[data-body-id]').forEach((el) => el.addEventListener('click', () => {
      selectedBodyId = el.getAttribute('data-body-id');
      renderBodyGrid();
    }));
  }

  function renderCardSelects(locked = false) {
    const used = selectedCards.filter(Boolean);
    cardSelects.forEach((select, index) => {
      const current = selectedCards[index];
      select.innerHTML = `<option value="">選択してください</option>` + (window.AM_DATA.cards || []).map((card) => {
        const disabled = used.includes(card.cardId) && current !== card.cardId;
        return `<option value="${window.AM.escapeHtml(card.cardId)}" ${current === card.cardId ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${window.AM.escapeHtml(card.cardName)} / ${window.AM.escapeHtml(card.skillName)}</option>`;
      }).join('');
      select.disabled = locked;
      if (!locked) select.onchange = () => {
        selectedCards[index] = select.value;
        renderCardSelects();
      };
    });
    deckCount.textContent = selectedCards.filter(Boolean).length;
    previewGrid.innerHTML = selectedCards.filter(Boolean).map((id) => window.AM.findCard(id)).filter(Boolean).map((card) => `
      <div class="preview-inline"><img src="${window.AM.escapeHtml(card.imagePath)}" alt="${window.AM.escapeHtml(card.cardName)}" class="preview-thumb" /><div><div class="preview-name">${window.AM.escapeHtml(card.skillName)}</div><div class="preview-text">${window.AM.escapeHtml(card.effectShort)}</div></div></div>`).join('') || `<div class="empty-note">カードを選ぶとここに表示されます。</div>`;
  }

  function renderPhaseBox(state) {
    let label = 'エントリー前';
    if (state.phase === 'battle') label = `ターン ${state.turn}`;
    else if (getPlayer(state).joined) label = '対戦開始待ち';
    phaseBox.className = 'phase-wrap single-phase';
    phaseBox.textContent = label;
  }

  function renderEntryReview(state) {
    const p = getPlayer(state);
    const body = window.AM.findBody(p.bodyId || selectedBodyId);
    const cards = (p.selectedCards?.length ? p.selectedCards : selectedCards).map((id) => window.AM.findCard(id)).filter(Boolean);
    entryReviewBox.innerHTML = `
      <div class="review-list">
        <div><strong>プレイヤー番号</strong><span>${getRole() === 'p1' ? 'プレイヤー1' : 'プレイヤー2'}</span></div>
        <div><strong>プレイヤー名</strong><span>${window.AM.escapeHtml(p.name || nameInput.value || '未設定')}</span></div>
        <div><strong>ルームコード</strong><span>${window.AM.escapeHtml(currentRoom)}</span></div>
        <div><strong>所持G / BET</strong><span>${p.gold}G / ${p.bet}G ${p.debt > 0 ? `（借金${p.debt}G）` : ''}</span></div>
        <div><strong>ボディ</strong><span>${window.AM.escapeHtml(body?.bodyName || '未選択')}</span></div>
        <div><strong>スキルカード</strong><span>${cards.map((c) => window.AM.escapeHtml(c.cardName)).join(' / ') || '未選択'}</span></div>
      </div>`;
  }

  function renderPlayerStatus(state) {
    const player = getPlayer(state);
    const opponent = getOpponent(state);
    const heart = 'assets/images/ui/icon_heart.png';
    const renderHp = (hp, shield = 0) => {
      const hpWidth = Math.max(0, Math.min(100, hp));
      const shieldWidth = Math.max(0, Math.min(100 - hpWidth, shield));
      const overClass = hp + shield > 100 ? 'over' : '';
      return `<div class="status-hp-wrap ${overClass}"><div class="status-hp-row"><img src="${heart}" alt="" class="status-heart" /><div class="hp-bar thick ${overClass}"><div class="hp-fill" style="width:${hpWidth}%"></div>${shieldWidth > 0 ? `<div class="shield-fill" style="left:${hpWidth}%;width:${shieldWidth}%"></div>` : ''}</div><div class="status-hp-number">${window.AM.formatHpShield(hp, shield)}</div></div></div>`;
    };
    statusBox.innerHTML = `
      <div class="status-card"><h3>${window.AM.escapeHtml(player.name || '未登録')}</h3><div class="status-line">所持金: ${player.gold}G ${player.debt > 0 ? `（借金${player.debt}G）` : ''}</div><div class="status-line">ベット: ${player.bet || 50}G</div>${renderHp(player.hp, player.shield || 0)}<div class="status-line">通常回復: ${Math.max(0, 2 - player.normalHealUsed)}回</div><div class="status-line">反撃のドラ: ${player.emergencyHealUsed ? '使用済み' : '未使用'}</div><div class="effects-row">${window.AM.createEffectBadges(player)}</div></div>
      <div class="status-card"><h3>相手</h3><div class="status-line">${window.AM.escapeHtml(opponent.name || '未参加')}</div>${renderHp(opponent.hp, opponent.shield || 0)}<div class="status-line">通常回復: ${Math.max(0, 2 - opponent.normalHealUsed)}回</div><div class="status-line">反撃のドラ: ${opponent.emergencyHealUsed ? '使用済み' : '未使用'}</div><div class="effects-row">${window.AM.createEffectBadges(opponent)}</div></div>`;
  }

  function renderActionButton(type, label, desc, extraAttrs = '', selected = false) {
    return `<button type="button" class="major-action action-${type}${selected ? ' selected-choice' : ''}" ${extraAttrs}>${label}<small>${desc}</small></button>`;
  }

  function closeReviewPanels(){ Object.values(togglePanels).forEach((panel)=>panel.classList.add('hidden')); }

  function renderActionPanel(state) {
    const player = getPlayer(state);
    if (state.phase === 'finished') { actionPanel.innerHTML = `<div class="empty-note">試合終了です。</div>`; return; }
    if (state.phase !== 'battle') { actionPanel.innerHTML = `<div class="empty-note">対戦開始後に行動を選べます。</div>`; return; }
    const currentSelection = pendingAction || player.submittedAction;
    const kickRemaining = Math.max(0, 2 - (player.attackUsage?.kick || 0));
    const throwRemaining = Math.max(0, 1 - (player.attackUsage?.throw || 0));
    const orderRole = state.turnSummary ? (state.turnSummary.firstPlayerRole === getRole() ? '先攻' : '後攻') : (state.firstAttackRole ? (state.firstAttackRole === getRole() ? '先攻' : '後攻') : '待機');
    const emergencyUnavailable = player.emergencyHealUsed || player.hp > 15;
    const emergencyDesc = player.emergencyHealUsed ? '使用済み' : (player.hp > 15 ? 'HP15以下で使用可能' : 'HP50まで回復');
    const previewAttackBonus = (player.effects?.nextAttackBonus || 0) + (player.effects?.attackBuffTurns > 0 ? 6 : 0) - (player.effects?.nextAttackPenalty || 0);
    const attackLabel = (base) => `${Math.max(0, base + previewAttackBonus)}ダメージ${previewAttackBonus !== 0 ? `（補正${previewAttackBonus > 0 ? '+' : ''}${previewAttackBonus}）` : ''}`;
    const skillButtons = (player.selectedCards || []).map((id) => window.AM.findCard(id)).filter(Boolean).map((card) => {
      const disabled = player.usedSkills.includes(card.skillKey);
      const selectedCls = currentSelection?.type === 'skill' && currentSelection.skillKey === card.skillKey ? ' selected-choice' : '';
      return `<button type="button" class="minor-action action-skill ${disabled ? 'disabled' : ''}${selectedCls}" ${disabled ? 'disabled' : ''} data-type="skill" data-skill-key="${card.skillKey}"><span>${window.AM.escapeHtml(card.skillName)}</span><small>${window.AM.escapeHtml(card.effectShort)}</small></button>`;
    }).join('');

    if (player.actionLocked && player.submittedAction) {
      actionPanel.innerHTML = `
        <div class="action-header-row">
          <div class="selected-action-box">選択中：${window.AM.escapeHtml(window.AM.describeAction(player.submittedAction).replace('瀕死回復','反撃のドラ（瀕死回復）'))}</div>
          <div class="turn-order-badge ${orderRole === '先攻' ? 'first' : orderRole === '後攻' ? 'second' : 'idle'}">次ターン：${orderRole}</div>
        </div>
        <div class="waiting-lock-box">
          <div class="waiting-lock-title">行動を送信済みです</div>
          <div class="submit-note">マスターが実行するまでは内容を変更できます。</div>
        </div>
        <div class="change-row"><button type="button" id="change-action" class="secondary">変更する</button></div>`;
      const changeBtn = document.getElementById('change-action');
      if (changeBtn) changeBtn.addEventListener('click', ()=>{
        window.AM.updateState(currentRoom, (s)=>{ const p=s.players[getRole()]; p.submittedAction=null; p.actionLocked=false; });
        render(window.AM.loadState(currentRoom));
      });
      return;
    }

    actionPanel.innerHTML = `
      <div class="action-header-row"><div class="selected-action-box">${currentSelection ? `選択中：${window.AM.escapeHtml(window.AM.describeAction(currentSelection).replace('瀕死回復','反撃のドラ（瀕死回復）'))}` : 'まだ行動を選択していません'}</div><div class="turn-order-badge ${orderRole === '先攻' ? 'first' : orderRole === '後攻' ? 'second' : 'idle'}">次ターン：${orderRole}</div></div>
      <div class="action-grid compact-two">
        ${renderActionButton('attack', '攻撃（こぶし）', attackLabel(18), 'data-type="attack" data-move="punch"', currentSelection?.type === 'attack' && currentSelection.move === 'punch')}
        ${renderActionButton('attack', '攻撃（足蹴り）', `${attackLabel(24)} / 残り${kickRemaining}回`, `data-type="attack" data-move="kick" ${kickRemaining <= 0 ? 'disabled' : ''}`, currentSelection?.type === 'attack' && currentSelection.move === 'kick')}
        ${renderActionButton('attack', '攻撃（背負い投げ）', `${attackLabel(32)} / 残り${throwRemaining}回`, `data-type="attack" data-move="throw" ${throwRemaining <= 0 ? 'disabled' : ''}`, currentSelection?.type === 'attack' && currentSelection.move === 'throw')}
        ${renderActionButton('heal', '回復', 'HP20回復', 'data-type="heal" data-mode="normal"', currentSelection?.type === 'heal' && currentSelection.mode === 'normal')}
        ${renderActionButton('guard', '防御', 'ダメージ10軽減', 'data-type="guard"', currentSelection?.type === 'guard')}
        ${renderActionButton('evade', '回避', '相手の通常攻撃を無効化', 'data-type="evade"', currentSelection?.type === 'evade')}
        ${renderActionButton('heal', '反撃のドラ（瀕死回復）', emergencyDesc, `data-type="heal" data-mode="emergency" ${emergencyUnavailable ? 'disabled' : ''}`, currentSelection?.type === 'heal' && currentSelection.mode === 'emergency')}
      </div>
      <div class="action-group"><h3>スキルを発動する</h3><div class="minor-actions">${skillButtons}</div></div>
      <div class="confirm-row"><button type="button" id="confirm-action" class="attention" ${!pendingAction || player.actionLocked ? 'disabled' : ''}>行動を確定する</button><div class="submit-note">前ターンで発動済みのスキルは再使用できません。</div></div>`;
    actionPanel.querySelectorAll('[data-type]').forEach((btn) => btn.addEventListener('click', () => {
      if (btn.disabled || player.actionLocked) return;
      pendingAction = { type: btn.getAttribute('data-type') };
      if (pendingAction.type === 'attack') pendingAction.move = btn.getAttribute('data-move');
      if (pendingAction.type === 'heal') pendingAction.mode = btn.getAttribute('data-mode') || 'normal';
      if (pendingAction.type === 'skill') pendingAction.skillKey = btn.getAttribute('data-skill-key');
      renderActionPanel(state);
    }));
    const confirmBtn = document.getElementById('confirm-action');
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      if (!pendingAction) return;
      window.AM.updateState(currentRoom, (s) => {
        const p = s.players[getRole()];
        p.submittedAction = pendingAction;
        p.actionLocked = true;
      });
      pendingAction = null;
      render(window.AM.loadState(currentRoom));
    });
  }
  function renderLog(state) {
    logBox.innerHTML = (state.battleLog || []).filter((line) => !line.includes('対戦開始。ベットをポットに積みました。')).map((line) => `<div class="player-log-line">${window.AM.escapeHtml(line)}</div>`).join('') || `<div class="empty-note">まだログはありません。</div>`;
  }

  function saveSetup() {
    const gold = getGoldValue();
    const rawBet = Number(betInput.value || 50);
    const maxBet = getAllowedBetMax(gold);
    const bet = clampBetForGold(rawBet, gold);
    const chosen = selectedCards.filter(Boolean);
    if (rawBet !== bet) {
      betInput.value = bet;
      setupNotice.textContent = gold < 50
        ? '所持Gが最低BET額(50G)に満たしていない場合は、50Gが上限です。'
        : `BET額は所持Gまで設定できます。現在の上限は${maxBet}Gです。`;
      return;
    }
    if (!selectedBodyId) { setupNotice.textContent = 'ボディを1枚選んでください。'; return; }
    if (chosen.length !== 3) { setupNotice.textContent = 'スキルカードを3枚選んでください。'; return; }
    const summary = `プレイヤー名：${nameInput.value.trim()}\nプレイヤー番号：${getRole() === 'p1' ? 'プレイヤー1' : 'プレイヤー2'}\nルームコード：${currentRoom}\n所持G：${gold}G / BET：${bet}G${Math.max(0, bet - gold) > 0 ? `（借金${Math.max(0, bet - gold)}G）` : ''}\nボディ：${window.AM.findBody(selectedBodyId)?.bodyName || ''}\nカード：${chosen.map((id) => window.AM.findCard(id)?.cardName).join(' / ')}`;
    if (!window.confirm(`この内容でエントリーしますか？\n\n${summary}`)) {
      setupNotice.textContent = '内容を確認して変更できます。';
      return;
    }
    window.AM.updateState(currentRoom, (state) => {
      const p = state.players[getRole()];
      p.joined = true;
      p.name = nameInput.value.trim().slice(0, 20);
      p.gold = gold;
      p.bet = bet;
      p.debt = Math.max(0, bet - gold);
      p.bodyId = selectedBodyId;
      p.selectedCards = [...chosen];
      if (state.phase === 'lobby') p.hp = 100;
    });
    [roleSelect,nameInput,roomInput,goldInput, betInput, ...cardSelects].forEach((el) => lockField(el, true));
    renderBodyGrid(true);
    renderCardSelects(true);
    setupNotice.textContent = 'エントリー完了。対戦画面へ切り替わりました。';
    setStage('battle');
    closeReviewPanels();
    render(window.AM.loadState(currentRoom));
  }
  saveSetupBtn.addEventListener('click', saveSetup);

  function sendMessage() {
    const value = (messageInput.value || '').trim().slice(0, 40);
    window.AM.updateState(currentRoom, (state) => {
      state.players[getRole()].message = value;
    });
    messageStatus.textContent = value ? '送信しました。' : 'メッセージをクリアしました。';
  }
  sendMessageBtn.addEventListener('click', sendMessage);

  function togglePanel(name) {
    const panel = togglePanels[name];
    if (!panel) return;
    const hidden = panel.classList.contains('hidden');
    closeReviewPanels();
    if (hidden) {
      panel.classList.remove('hidden');
      panel.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }
  Object.entries(toggleButtons).forEach(([name, btn]) => { if (btn) btn.onclick = () => togglePanel(name); });

  function render(state) {
    const nextRematchToken = state.rematchToken || 0;
    if (nextRematchToken !== lastRematchToken) {
      lastRematchToken = nextRematchToken;
      handleRematchTransition(state);
    }
    renderBodyGrid(stage !== 'setup');
    renderCardSelects(stage !== 'setup');
    renderPhaseBox(state);
    renderPlayerStatus(state);
    renderEntryReview(state);
    renderActionPanel(state);
    renderLog(state);
    twicaBox.innerHTML = '';
  }

  unsubscribe = window.AM.subscribeState(currentRoom, render);
  render(window.AM.loadState(currentRoom));
})();
