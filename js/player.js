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
  const deckBonusNote = document.getElementById('deck-bonus-note');
  const twicaBox = document.getElementById('twica-box');
  const phaseBox = document.getElementById('phase-box');
  const actionPanel = document.getElementById('action-panel');
  const statusBox = document.getElementById('status-box');
  const logBox = document.getElementById('player-log');
  const entryReviewBox = document.getElementById('entry-review-box');
  const joinNotice = document.getElementById('join-notice');
  const setupNotice = document.getElementById('setup-notice');
  const identityNotice = document.getElementById('identity-notice');
  const previewGrid = document.getElementById('card-preview-grid');
  const cardSelects = [1, 2, 3].map((n) => document.getElementById(`card-select-${n}`));
  const toggleButtons = {
    entry: document.getElementById('open-entry-review'),
    status: document.getElementById('open-status-review'),
  };
  const togglePanels = {
    entry: document.getElementById('entry-review-panel'),
    status: document.getElementById('status-review-panel'),
  };
  const ruleButtons = document.querySelectorAll('[data-open-rules]');
  const exitButtons = document.querySelectorAll('[data-exit-top]');
  const turnSelect = document.getElementById('turn-select');
  const turnSelectWrap = document.getElementById('turn-select-wrap');
  const floatingChatWidget = document.getElementById('floating-chat-widget');
  const topMenuButton = document.getElementById('open-top-menu');

  let currentRoom = window.AM.DEFAULT_ROOM;
  let selectedBodyId = '';
  let selectedCards = ['', '', ''];
  let pendingAction = null;
  let stage = 'intro';
  let unsubscribe = null;
  let lastRematchToken = 0;
  let selectedTurnHistory = 0;
  let floatingExpanded = false;
  let lastFinishedSignature = '';
  let phaseDetailsOpen = { self: false, opponent: false };
  let chatPinnedToBottom = true;
  let chatPendingNew = false;
  let lastChatCount = 0;
  let chatScrollOffsetFromBottom = 0;

  function setStage(next) {
    stage = next;
    introStage.classList.toggle('hidden', next !== 'intro');
    identityStage.classList.toggle('hidden', next !== 'identity');
    roomStage.classList.toggle('hidden', next !== 'room');
    setupStage.classList.toggle('hidden', next !== 'setup');
    battleStage.classList.toggle('hidden', next !== 'battle');
    if (flowHeader) { flowHeader.classList.toggle('hidden', next === 'intro'); const actions = flowHeader.querySelector('.player-flow-actions'); if (actions) actions.innerHTML = next === 'intro' ? '' : '<button type="button" id="flow-open-menu" class="top-menu-button small">☰</button>'; const flowMenuBtn = document.getElementById('flow-open-menu'); if (flowMenuBtn) flowMenuBtn.addEventListener('click', () => { const modal = ensureTopMenu(); if (modal.openMenuList) modal.openMenuList(); modal.classList.remove('hidden'); }); }
    if (next !== 'battle' && floatingChatWidget) floatingChatWidget.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  setStage('intro');

  function getRole() { return roleSelect.value || 'p1'; }
  function currentState() { return window.AM.loadState(currentRoom); }
  function getPlayer(state) { return state.players[getRole()]; }
  function getOpponent(state) { return state.players[window.AM.getOpponentRole(getRole())]; }
  function lockField(el, locked) { if (el) el.disabled = !!locked; }
  function dragonState(player) {
    if (player.emergencyHealUsed) return '使用済';
    if (player.hp <= 15) return '発動可';
    return '未解放';
  }
  function currentOrder(state) {
    if (state.phase !== 'battle') return '待機';
    return state.firstAttackRole === getRole() ? '先攻' : '後攻';
  }
  function nextOrder(state) {
    if (state.phase !== 'battle') return '待機';
    const nextFirst = state.firstAttackRole === 'p1' ? 'p2' : 'p1';
    return nextFirst === getRole() ? '先攻' : '後攻';
  }
  function skillDisplay(skillKey) {
    const skill = window.AM.findSkill(skillKey);
    return `${skill ? skill.skillName : skillKey}(スキル)`;
  }
  function selectedActionLabel(action) {
    if (!action) return '未入力';
    if (action.type === 'attack') return `攻撃(${window.AM.moveLabel(action.move)})`;
    if (action.type === 'guard') return '防御';
    if (action.type === 'evade') return '回避';
    if (action.type === 'heal') return action.mode === 'emergency' ? '反撃のドラ' : '回復';
    if (action.type === 'skill') return skillDisplay(action.skillKey);
    return window.AM.describeAction(action);
  }


  function phaseLabel(state) {
    return window.AM.battlePhaseLabel(state, getPlayer(state).joined);
  }

  function goldDisplay(player) {
    return player.debt > 0 ? `${player.gold - player.debt}G（借金${player.debt}G）` : `${player.gold}G`;
  }

  function getDisplaySnapshot(state, role) {
    return state.players[role];
  }

  function getGoldValue() { return Math.max(0, Number(goldInput.value || 0)); }
  function getAllowedBetMax(gold = getGoldValue()) { return Math.max(50, Number(gold || 0)); }
  function clampBetForGold(bet, gold = getGoldValue()) { return Math.min(Math.max(50, Number(bet || 50)), getAllowedBetMax(gold)); }

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
      if (showNotice) setupNotice.textContent = gold < 50 ? '所持Gが最低BET額(50G)に満たしていない場合は、50Gが上限です。' : `BET額は所持Gまで設定できます。現在の上限は${maxBet}Gです。`;
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
  exitButtons.forEach((btn) => btn.addEventListener('click', () => {
    const msg = stage === 'battle' ? '対戦中ですが、退出してトップページに戻りますか？' : 'トップページに戻りますか？ 現在の入力内容はこの端末では保持されません。';
    if (confirm(msg)) location.reload();
  }));
  startEntryBtn.addEventListener('click', () => setStage('identity'));

  function topMenuPageContent(key) {
    const map = {
      about: {
        title: '🎮️このゲームについて',
        body: `あまおと丸が、ほんの出来心で
AIセバス(ChatGPT)につくらせたものです。

ゲームに登場するキャラクターや
ゲーム内通貨は架空のものです。

リスナーさんに楽しんでもらいたいので、
本気と書いて「ガチ」でも
相手をリスペクトして遊んでくださいね。

ちなみに、
このサイトはブックマークして
ウェブアプリ化できるようにしています。

アクセスしやすいように
お好みでご活用ください。`
      },
      refresh: {
        title: '🖥️ブラウザ更新の仕方',
        body: `旧データが残っていると
うまくルームに入れないことがあります。

その時はお使いの端末で
リロードしてみてください。

＜やり方＞
Windows：F5またはctrl＋R
Mac：Command＋R

スマホ：各ブラウザアプリによる
（ぐるぐるボタンとか画面引っ張ったり）

⚠️：キャッシュ削除も有効ですが、
他サイトもログアウトしないよう
気をつけてください！`
      },
      credit: {
        title: '🌧️クレジット表記',
        body: `＜企画・制作＞
あまおと丸

＜助手＞
AIセバスチャン(ChatGPT)

＜協力＞
テスト版の試遊に協力いただいた
リスナーの皆さん

＜Special Thanks＞
▼TwiCa
https://twica.bluemoon.works/

▼DOT ILLUST
https://dot-illust.net/`
      },
      rules: { title: '📘ルール・戦闘の流れ', body: '' }
    };
    return map[key] || map.about;
  }

  function ensureTopMenu() {
    let modal = document.getElementById('top-menu-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'top-menu-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-backdrop" data-close-top-menu="true"></div>
      <div class="modal-panel top-menu-modal-panel app-menu-shell">
        <div class="app-menu-toolbar">
          <button class="menu-icon-box hidden" type="button" id="top-menu-back"><img src="assets/images/ui/back_br.png" alt="戻る"></button>
          <button class="menu-icon-box" type="button" id="top-menu-close">×</button>
        </div>
        <div id="top-menu-list" class="top-menu-list center-menu-list"></div>
        <div id="top-menu-page" class="top-menu-page hidden"></div>
      </div>`;
    document.body.appendChild(modal);
    const closeMenu = () => { renderList(); modal.classList.add('hidden'); render(window.AM.loadState(currentRoom)); };
    const listEl = modal.querySelector('#top-menu-list');
    const pageEl = modal.querySelector('#top-menu-page');
    const backBtn = modal.querySelector('#top-menu-back');
    const closeBtn = modal.querySelector('#top-menu-close');
    const renderList = () => {
      backBtn.classList.add('hidden');
      listEl.classList.remove('hidden');
      pageEl.classList.add('hidden');
      const isBattleLike = stage === 'battle' || stage === 'setup' || stage === 'identity' || stage === 'room';
      listEl.innerHTML = `
        ${isBattleLike ? '<button type="button" class="menu-line-item" data-page="rules">ルール・戦闘の流れ</button><div class="menu-divider"></div>' : ''}
        <button type="button" class="menu-line-item" data-page="about">このゲームについて</button>
        <div class="menu-divider"></div>
        <button type="button" class="menu-line-item" data-page="refresh">ブラウザ更新の仕方</button>
        <div class="menu-divider"></div>
        <button type="button" class="menu-line-item" data-page="credit">クレジット表記</button>
        ${isBattleLike ? '<div class="menu-divider"></div><button type="button" class="menu-danger-item" id="top-menu-exit">退出する</button>' : ''}`;
      listEl.querySelectorAll('[data-page]').forEach((btn) => btn.addEventListener('click', () => renderPage(btn.getAttribute('data-page'))));
      const exitBtn = listEl.querySelector('#top-menu-exit');
      if (exitBtn) exitBtn.addEventListener('click', () => {
        const msg = stage === 'battle' ? '対戦中ですが、退出してトップページに戻りますか？' : 'トップページに戻りますか？ 現在の入力内容はこの端末では保持されません。';
        if (confirm(msg)) location.reload();
      });
    };
    const renderPage = (key) => {
      const page = topMenuPageContent(key);
      backBtn.classList.add('hidden');
      listEl.classList.add('hidden');
      pageEl.classList.remove('hidden');
      const backRow = `<div class="menu-page-bottom"><button type="button" class="menu-back-bottom" id="top-menu-back-bottom"><img src="assets/images/ui/back_br.png" alt="戻る">メニュー一覧に戻る</button></div>`;
      if (key === 'rules') {
        pageEl.innerHTML = `<div class="top-menu-page-title">${page.title}</div><div class="page-divider"></div><div class="rules-page-body rules-left">${window.AM.createRulesHTML ? window.AM.createRulesHTML() : ''}</div>${backRow}`;
      } else {
        pageEl.innerHTML = `<div class="top-menu-page-title">${page.title}</div><div class="page-divider"></div><div class="top-menu-page-body">${window.AM.escapeHtml(page.body).replace(/\n/g, '<br>')}</div>${backRow}`;
      }
      const bottomBack = pageEl.querySelector('#top-menu-back-bottom');
      if (bottomBack) bottomBack.addEventListener('click', renderList);
    };
    modal.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.getAttribute('data-close-top-menu') === 'true') closeMenu();
    });
    closeBtn.addEventListener('click', closeMenu);
    backBtn.addEventListener('click', renderList);
    renderList();
    modal.openMenuList = renderList;
    return modal;
  }
  if (topMenuButton) topMenuButton.addEventListener('click', () => { const modal = ensureTopMenu(); if (modal.openMenuList) modal.openMenuList(); modal.classList.remove('hidden'); });

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
        return `<option value="${window.AM.escapeHtml(card.cardId)}" ${current === card.cardId ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${window.AM.escapeHtml(card.cardName)} / ${window.AM.escapeHtml(card.skillName)} / レア度(${window.AM.escapeHtml(card.rarity || '')})</option>`;
      }).join('');
      select.disabled = locked;
      if (!locked) select.onchange = () => {
        selectedCards[index] = select.value;
        renderCardSelects();
      };
    });
    const chosenCards = selectedCards.filter(Boolean).map((id) => window.AM.findCard(id)).filter(Boolean);
    deckCount.textContent = chosenCards.length;
    previewGrid.innerHTML = chosenCards.map((card) => `
      <div class="preview-inline"><img src="${window.AM.escapeHtml(card.imagePath)}" alt="${window.AM.escapeHtml(card.cardName)}" class="preview-thumb" /><div><div class="preview-name">${window.AM.escapeHtml(card.skillName)} <span class="preview-rarity">(${window.AM.escapeHtml(card.rarity || '')})</span></div><div class="preview-text">${window.AM.escapeHtml(card.effectShort)}</div></div></div>`).join('') || `<div class="empty-note">カードを選ぶとここに表示されます。</div>`;
    const bonusEligible = chosenCards.length === 3 && chosenCards.every((card) => card.rarity === '★2');
    deckBonusNote.classList.toggle('hidden', !bonusEligible);
    deckBonusNote.textContent = bonusEligible ? 'デッキボーナス対象です(対戦開始時シールド＋10)' : '';
  }

  function renderPhaseBox(state) {
    const selfRole = getRole();
    const oppRole = window.AM.getOpponentRole(selfRole);
    const player = getDisplaySnapshot(state, selfRole);
    const opponent = getDisplaySnapshot(state, oppRole);
    phaseBox.className = `phase-wrap phase-${state.phase} compact-phase-wrap ${state.phase === 'battle' && state.turn === 10 ? 'final-turn' : ''}`;
    phaseBox.innerHTML = `
      <div class="phase-banner-plate rounded-all">${window.AM.escapeHtml(phaseLabel(state))}</div>
      <div class="phase-player-stack">
        ${renderPhasePlayerCard(state, player.name || 'プレイヤー1', player, 'self', selfRole)}
        ${renderPhasePlayerCard(state, opponent.name || 'プレイヤー2', opponent, 'opponent', oppRole)}
      </div>`;
    phaseBox.querySelectorAll('[data-phase-toggle]').forEach((btn) => btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-phase-toggle');
      phaseDetailsOpen[key] = !phaseDetailsOpen[key];
      renderPhaseBox(currentState());
    }));
  }

  function renderPhasePlayerCard(state, title, player, key, role) {
    const hp = Math.max(0, Math.min(100, Number(player.hp || 0)));
    const shield = Math.max(0, Number(player.shield || 0));
    const shieldWithin = Math.max(0, Math.min(100 - hp, shield));
    const overClass = hp + shield > 100 ? 'over' : '';
    const expanded = !!phaseDetailsOpen[key];
    const pendingFirstOnly = state.phase === 'battle' && state.turnExecutionStage === 'first' && state.pendingTurnData;
    const allowSummary = !(pendingFirstOnly && role !== state.pendingTurnData.firstRole);
    const currentSummary = state.phase === 'battle' && state.turnSummary && state.turnSummary.turn === state.turn ? state.turnSummary.entries?.[role] : null;
    const inSelection = state.phase === 'battle' && state.turnExecutionStage === 'selection';
    const badgeText = state.phase !== 'battle'
      ? '対戦開始前'
      : (inSelection ? (player.actionLocked ? '行動選択済み' : '行動選択中') : `${window.AM.formatTurnLabel(state.turn)}：${state.firstAttackRole === role ? '先攻' : '後攻'}`);
    const badgeClass = inSelection ? (player.actionLocked ? 'selection-done' : 'selection') : ((state.firstAttackRole === role) ? 'first' : 'second');
    const selected = allowSummary && currentSummary?.choiceLabel ? currentSummary.choiceLabel : '未入力';
    const hpDeltaLabel = state.phase === 'battle'
      ? ((state.turnSummary?.entries?.[role]?.currentHpDeltaLabel) || 'HP：変動なし')
      : 'HP：変動なし';
    const effects = window.AM.createEffectBadges(player) || '<span class="empty-note compact">継続効果なし</span>';
    return `
      <div class="phase-player-card compact-phase-player-card ${expanded ? 'expanded' : ''}">
        <div class="phase-player-toprow unified same-line-head">
          <div class="phase-player-name">${window.AM.escapeHtml(title)}</div>
          <div class="phase-player-head-right">
            <span class="phase-player-turnbadge ${badgeClass}">${window.AM.escapeHtml(badgeText)}</span>
            <button type="button" class="phase-expand-btn" data-phase-toggle="${key}" aria-expanded="${expanded ? 'true' : 'false'}">${expanded ? '－' : '＋'}</button>
          </div>
        </div>
        <div class="phase-player-hpbar-row spectator-like">
          <img src="assets/images/ui/icon_heart.png" alt="" class="status-heart" />
          <div class="hp-bar thick ${overClass}"><div class="hp-fill" style="width:${hp}%"></div>${shieldWithin > 0 ? `<div class="shield-fill" style="left:${hp}%;width:${shieldWithin}%"></div>` : ''}</div>
          <div class="phase-player-hpnum">${window.AM.renderHpShieldInline(hp, shield)}</div>
        </div>
        <div class="phase-player-choice-row"><span class="choice-badge phase-choice-badge ${actionBadgeClass(selected)}">${window.AM.escapeHtml(selected)}</span></div>
        <div class="phase-player-hpresult"><span class="hp-result-pill">${window.AM.escapeHtml(hpDeltaLabel)}</span></div>
        ${expanded ? `<div class="phase-player-detail">
          <div class="phase-detail-row single-line"><span class="phase-detail-chip">スキル残 ${Math.max(0, 3 - (player.usedSkills || []).length)}</span><span class="phase-detail-chip">回復残 ${Math.max(0, 1 - (player.normalHealUsed || 0))}</span><span class="phase-detail-chip">ドラ ${window.AM.escapeHtml(dragonState(player))}</span></div>
          <div class="effects-row phase-effects-row">${effects}</div>
        </div>` : ''}
      </div>`;
  }

  function renderEntryReview(state) {
    const player = getPlayer(state);
    const body = window.AM.findBody(player.bodyId);
    const cards = (player.selectedCards || []).map((id) => window.AM.findCard(id)).filter(Boolean);
    entryReviewBox.innerHTML = `
      <div class="entry-summary-grid slim-entry-summary">
        <div class="entry-summary-card"><strong>プレイヤー名</strong><span>${window.AM.escapeHtml(player.name || '未入力')}</span></div>
        <div class="entry-summary-card"><strong><img src="assets/images/ui/icon_coin.png" alt="" class="inline-icon">所持G / BET</strong><span>${player.gold}G / ${player.bet || 50}G${player.debt > 0 ? `（借金${player.debt}G）` : ''}</span></div>
      </div>
      <div class="entry-review-box-body compact-review-list">${body ? window.AM.createBodyHTML(body, true) : '<div class="empty-note">未選択</div>'}</div>
      <div class="entry-review-box-cards compact-review-list">${cards.map((card) => window.AM.createCardHTML(card)).join('') || '<div class="empty-note">未選択</div>'}</div>`;
  }

  function battleStatusCard(title, player, state, isSelf) {
    const skillCount = Array.isArray(player.usedSkills) ? player.usedSkills.length : 0;
    const effects = window.AM.createEffectBadges(player) || '<span class="empty-note compact">継続効果なし</span>';
    const current = isSelf ? currentOrder(state) : (currentOrder(state) === '先攻' ? '後攻' : '先攻');
    const next = isSelf ? nextOrder(state) : (nextOrder(state) === '先攻' ? '後攻' : '先攻');
    return `
      <div class="status-card battle-review-card">
        <h3>${window.AM.escapeHtml(title)}</h3>
        <div class="status-line large">HP ${player.hp} / シールド ${player.shield || 0}</div>
        <div class="status-line">スキル ${skillCount}/3 ・ 回復 残${Math.max(0, 1 - player.normalHealUsed)} ・ ドラ ${dragonState(player)}</div>
        <div class="status-line">現在：${current} ／ 次：${next}</div>
        <div class="effects-row">${effects}</div>
      </div>`;
  }

  function renderPlayerStatus(state) {
    const histories = state.turnHistories || [];
    const includeCurrent = state.phase === 'battle' && state.turnSummary;
    const items = includeCurrent ? [state.turnSummary, ...histories] : histories;
    turnSelectWrap.classList.toggle('hidden', !items.length);
    if (turnSelect) {
      turnSelect.innerHTML = items.map((history, index) => `<option value="${index}">${window.AM.formatTurnLogLabel ? window.AM.formatTurnLogLabel(history.turn) : `${history.turn}ターン目`}</option>`).join('');
      if (selectedTurnHistory >= items.length) selectedTurnHistory = 0;
      turnSelect.value = String(selectedTurnHistory);
      turnSelect.onchange = () => { selectedTurnHistory = Number(turnSelect.value || 0); renderPlayerStatus(currentState()); };
    }
    const history = items[selectedTurnHistory];
    const isCurrentPending = history && history === state.turnSummary && !!state.pendingTurnData;
    if (!history) {
      statusBox.innerHTML = '<div class="empty-note">まだ実行結果がありません。</div>';
      return;
    }
    const blocks = [];
    const addBlock = (title, lines) => {
      if (!lines || !lines.length) return;
      blocks.push(`<div class="turn-role-label">${title}</div>${lines.map((line) => `<div class="player-log-line">${window.AM.decorateLogLine ? window.AM.decorateLogLine(line) : window.AM.escapeHtml(line)}</div>`).join('')}`);
    };
    addBlock('先攻', (history.firstLines || []).slice(1));
    if (!isCurrentPending) {
      addBlock('後攻', (history.secondLines || []).slice(1));
      addBlock('結果', (history.resultLines || []).slice(1));
    }
    statusBox.innerHTML = `<div class="status-card turn-history-card log-only-card full-width-log">${blocks.join('')}</div>`;
  }

  function renderActionButton(type, label, desc, extraAttrs = '', selected = false) {
    return `<button type="button" class="major-action action-${type}${selected ? ' selected-choice' : ''}" ${extraAttrs}>${label}<small>${desc}</small></button>`;
  }
  function closeReviewPanels() { Object.values(togglePanels).forEach((panel) => panel.classList.add('hidden')); }

  function actionDetailLabel(action) {
    if (!action) return '未入力';
    return selectedActionLabel(action);
  }

  function actionBadgeClass(label) {
    if (!label || label === '未入力' || label === '行動待機中') return 'waiting';
    if (label.includes('攻撃')) return 'attack';
    if (label.includes('回復') || label.includes('反撃のドラ')) return 'heal';
    if (label.includes('防御')) return 'guard';
    if (label.includes('回避')) return 'evade';
    if (label.includes('(スキル)')) return 'skill';
    return 'waiting';
  }

  function renderActionPanel(state) {
    const player = getPlayer(state);
    if (state.phase === 'finished') { actionPanel.innerHTML = `<div class="empty-note">試合終了です。</div>`; return; }
    if (state.phase !== 'battle') { actionPanel.innerHTML = `<div class="empty-note">対戦開始後に行動を選べます。</div>`; return; }
    const currentSelection = pendingAction || player.submittedAction;
    const kickRemaining = Math.max(0, 2 - (player.attackUsage?.kick || 0));
    const throwRemaining = Math.max(0, 1 - (player.attackUsage?.throw || 0));
    const orderRole = nextOrder(state);
    const emergencyUnavailable = player.emergencyHealUsed || player.hp > 15;
    const emergencyDesc = player.emergencyHealUsed
      ? '使用済み'
      : (player.hp > 15
        ? 'HP15以下で使用可能<br>「いたずら」のランダム対象'
        : 'HPを50まで回復<br>「いたずら」のランダム対象');
    const skillButtons = (player.selectedCards || []).map((id) => window.AM.findCard(id)).filter(Boolean).map((card) => {
      const disabled = player.usedSkills.includes(card.skillKey);
      const selectedCls = currentSelection?.type === 'skill' && currentSelection.skillKey === card.skillKey ? ' selected-choice' : '';
      return `<button type="button" class="minor-action action-skill ${disabled ? 'disabled' : ''}${selectedCls}" ${disabled ? 'disabled' : ''} data-type="skill" data-skill-key="${card.skillKey}"><span>${window.AM.escapeHtml(card.skillName)}</span><small>${window.AM.escapeHtml(card.effectShort)}</small></button>`;
    }).join('');

    if (state.phase === 'battle' && state.turnExecutionStage !== 'selection') {
      actionPanel.innerHTML = `<div class="selected-action-box waiting-master">マスターによる操作待ち</div>`;
      return;
    }
    if (player.actionLocked && player.submittedAction) {
      actionPanel.innerHTML = `
        <div class="action-header-row">
          <div class="selected-action-box">選択中：${window.AM.escapeHtml(actionDetailLabel(player.submittedAction))}</div>
          <div class="turn-order-badge ${orderRole === '先攻' ? 'first' : orderRole === '後攻' ? 'second' : 'idle'}">次ターン：${orderRole}</div>
        </div>
        <div class="waiting-lock-box"><div class="waiting-lock-title">行動を送信済みです</div><div class="submit-note">マスターが実行するまでは内容を変更できます。</div></div>
        <div class="change-row"><button type="button" id="change-action" class="secondary">変更する</button></div>`;
      const changeBtn = document.getElementById('change-action');
      if (changeBtn) changeBtn.addEventListener('click', () => {
        window.AM.updateState(currentRoom, (s) => { const p = s.players[getRole()]; p.submittedAction = null; p.actionLocked = false; });
        render(window.AM.loadState(currentRoom));
      });
      return;
    }

    actionPanel.innerHTML = `
      <div class="action-header-row"><div class="selected-action-box">${currentSelection ? `選択中：${window.AM.escapeHtml(actionDetailLabel(currentSelection))}` : 'まだ行動を選択していません'}</div><div class="turn-order-badge ${orderRole === '先攻' ? 'first' : orderRole === '後攻' ? 'second' : 'idle'}">次ターン：${orderRole}</div></div>
      <div class="action-grid compact-two">
        ${renderActionButton('attack', '攻撃(こぶし)', '18〜22ダメージ', 'data-type="attack" data-move="punch"', currentSelection?.type === 'attack' && currentSelection.move === 'punch')}
        ${renderActionButton('attack', '攻撃(足蹴り)', `24ダメージ（残り${kickRemaining}回）`, `data-type="attack" data-move="kick" ${kickRemaining <= 0 ? 'disabled' : ''}`, currentSelection?.type === 'attack' && currentSelection.move === 'kick')}
        ${renderActionButton('attack', '攻撃(背負い投げ)', `32ダメージ（残り${throwRemaining}回）`, `data-type="attack" data-move="throw" ${throwRemaining <= 0 ? 'disabled' : ''}`, currentSelection?.type === 'attack' && currentSelection.move === 'throw')}
        ${renderActionButton('heal', '回復', `HP20回復（残り${Math.max(0, 1 - player.normalHealUsed)}回）`, `data-type="heal" data-mode="normal" ${player.normalHealUsed >= 1 ? 'disabled' : ''}`, currentSelection?.type === 'heal' && currentSelection.mode === 'normal')}
        ${renderActionButton('guard', '防御', 'ダメージ10軽減', 'data-type="guard"', currentSelection?.type === 'guard')}
        ${renderActionButton('evade', '回避', '50%で相手の攻撃を無効化', 'data-type="evade"', currentSelection?.type === 'evade')}
        ${renderActionButton('heal', '反撃のドラ', emergencyDesc, `data-type="heal" data-mode="emergency" ${emergencyUnavailable ? 'disabled' : ''}`, currentSelection?.type === 'heal' && currentSelection.mode === 'emergency')}
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
      window.AM.updateState(currentRoom, (s) => { const p = s.players[getRole()]; p.submittedAction = pendingAction; p.actionLocked = true; });
      pendingAction = null;
      render(window.AM.loadState(currentRoom));
    });
  }

  function renderLog(state) {
    logBox.innerHTML = (state.battleLog || []).map((line) => `<div class="player-log-line">${window.AM.decorateLogLine ? window.AM.decorateLogLine(line) : window.AM.escapeHtml(line)}</div>`).join('') || `<div class="empty-note">まだログはありません。</div>`;
  }

  function renderFloatingMessageBar(state) {
    if (!floatingChatWidget) return;
    if (stage !== 'battle') { floatingChatWidget.classList.add('hidden'); return; }
    const history = Array.isArray(state.chatHistory) ? state.chatHistory : [];
    floatingChatWidget.classList.remove('hidden');
    floatingChatWidget.classList.toggle('expanded', floatingExpanded);
    const items = history.length
      ? history.map((item) => {
          const mine = item.role === getRole();
          return `<div class="chat-history-item ${mine ? 'mine' : 'theirs'}"><div class="chat-history-name">${window.AM.escapeHtml(item.name || '')}</div><div class="chat-history-bubble">${window.AM.escapeHtml(item.text || '')}</div></div>`;
        }).join('')
      : `<div class="chat-history-empty"><img src="assets/images/ui/hukidashi_on_black.png" alt="" class="chat-empty-icon"><div>ここに対戦中のひとことが表示されます</div></div>`;
    floatingChatWidget.innerHTML = `
      <button type="button" class="chat-fab ${floatingExpanded ? 'hidden' : ''}" id="open-chat-widget">チャット<img src="assets/images/ui/hukidashi_on_black.png" alt=""></button>
      <div class="chat-panel ${floatingExpanded ? '' : 'hidden'}">
        <div class="chat-panel-head"><div class="chat-panel-title">ひとことチャット <img src="assets/images/ui/hukidashi_on_black.png" alt=""></div><button type="button" class="chat-close-btn" id="close-chat-widget">×</button></div>
        <div class="chat-panel-sub">このチャットは相手と観戦画面に表示されます。</div>
        <div class="chat-history-wrap"><div class="chat-history-scroll" id="chat-history-scroll"><div class="chat-history-list">${items}</div></div>
        <button type="button" class="chat-latest-pill ${chatPendingNew ? '' : 'hidden'}" id="chat-jump-latest">↓最新のメッセージが<br>あります</button></div>
        <div class="chat-input-row"><input id="floating-message-input" maxlength="40" value="" placeholder="ひとことメッセージを送信する"><button type="button" id="floating-send-message">送信</button></div>
      </div>`;
    const openBtn = document.getElementById('open-chat-widget');
    const closeBtn = document.getElementById('close-chat-widget');
    const sendBtn = document.getElementById('floating-send-message');
    const input = document.getElementById('floating-message-input');
    const scrollEl = document.getElementById('chat-history-scroll');
    const jumpBtn = document.getElementById('chat-jump-latest');
    const stickToBottom = () => {
      if (!scrollEl) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
      chatPinnedToBottom = true;
      chatPendingNew = false;
      chatScrollOffsetFromBottom = 0;
      chatScrollOffsetFromBottom = 0;
      if (jumpBtn) jumpBtn.classList.add('hidden');
    };
    if (scrollEl) {
      scrollEl.addEventListener('scroll', () => {
        const offset = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
        const nearBottom = offset < 24;
        chatPinnedToBottom = nearBottom;
        chatScrollOffsetFromBottom = Math.max(0, offset);
        if (nearBottom) {
          chatPendingNew = false;
          if (jumpBtn) jumpBtn.classList.add('hidden');
        }
      }, { passive: true });
      requestAnimationFrame(() => {
        if (chatPinnedToBottom) {
          stickToBottom();
        } else {
          scrollEl.scrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight - chatScrollOffsetFromBottom);
          if (chatPendingNew && jumpBtn) jumpBtn.classList.remove('hidden');
        }
      });
    }
    if (jumpBtn) jumpBtn.onclick = stickToBottom;
    if (openBtn) openBtn.onclick = () => { floatingExpanded = true; chatPinnedToBottom = true; renderFloatingMessageBar(currentState()); };
    if (closeBtn) closeBtn.onclick = () => { floatingExpanded = false; renderFloatingMessageBar(currentState()); };
    if (sendBtn) sendBtn.onclick = () => {
      const value = (input.value || '').trim().slice(0, 40);
      window.AM.updateState(currentRoom, (s) => {
        const role = getRole();
        const p = s.players[role];
        p.message = value;
        if (!Array.isArray(s.chatHistory)) s.chatHistory = [];
        if (value) s.chatHistory.push({ id: Date.now(), role, name: p.name, text: value });
      });
      input.value = '';
      chatPinnedToBottom = true;
      chatPendingNew = false;
    };
  }

  function showBattleResultDialog(state) {
    if (stage !== 'battle' || state.phase !== 'finished' || !state.resultSummary) return;
    const sig = `${state.updatedAt || ''}_${state.winner}_${state.resultSummary?.rewardText || ''}`;
    if (sig === lastFinishedSignature) return;
    lastFinishedSignature = sig;
    const player = getPlayer(state);
    const me = state.resultSummary.players[getRole()];
    const bet = player.bet || 50;
    let title = '対戦終了';
    let body = '';
    if (state.winner === 'draw') body = `引き分けです。あなたのBET額${bet}Gは返還されました。`;
    else if (state.winner === getRole()) body = `あなたが勝ちました。合計BET額${state.matchBet?.total || 0}Gが付与されました。`;
    else {
      const winnerName = state.resultSummary.players[state.winner]?.name || '勝者';
      body = `負けました。合計BET額${state.matchBet?.total || 0}Gが${winnerName}に付与されました。`;
    }
    const goldText = me ? (me.debt > 0 ? `${me.gold - me.debt}G（借金${me.debt}G）` : `${me.gold}G`) : goldDisplay(player);
    let modal = document.getElementById('battle-result-dialog');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'battle-result-dialog';
      modal.className = 'modal hidden';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div class="modal-backdrop"></div><div class="modal-panel battle-result-panel"><h3>${title}</h3><p>${body}</p><p>現在の所持G：${goldText}</p><div class="entry-actions stage-actions stage-actions-center"><button type="button" class="secondary" id="close-battle-result">OK</button></div></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('#close-battle-result').onclick = () => modal.classList.add('hidden');
  }

  function saveSetup() {
    const gold = getGoldValue();
    const rawBet = Number(betInput.value || 50);
    const maxBet = getAllowedBetMax(gold);
    const bet = clampBetForGold(rawBet, gold);
    const chosen = selectedCards.filter(Boolean);
    if (rawBet !== bet) {
      betInput.value = bet;
      setupNotice.textContent = gold < 50 ? '所持Gが最低BET額(50G)に満たしていない場合は、50Gが上限です。' : `BET額は所持Gまで設定できます。現在の上限は${maxBet}Gです。`;
      return;
    }
    if (!selectedBodyId) { setupNotice.textContent = 'ボディを1枚選んでください。'; return; }
    if (chosen.length !== 3) { setupNotice.textContent = 'スキルカードを3枚選んでください。'; return; }
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
    [roleSelect, nameInput, roomInput, goldInput, betInput, ...cardSelects].forEach((el) => lockField(el, true));
    renderBodyGrid(true);
    renderCardSelects(true);
    setupNotice.textContent = 'エントリー完了。対戦画面へ切り替わりました。';
    setStage('battle');
    closeReviewPanels();
    render(window.AM.loadState(currentRoom));
  }
  saveSetupBtn.addEventListener('click', saveSetup);

  function togglePanel(name) {
    const panel = togglePanels[name];
    if (!panel) return;
    const hidden = panel.classList.contains('hidden');
    closeReviewPanels();
    if (hidden) panel.classList.remove('hidden');
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
    const history = Array.isArray(state.chatHistory) ? state.chatHistory : [];
    if (floatingExpanded && history.length > lastChatCount && !chatPinnedToBottom) chatPendingNew = true;
    lastChatCount = history.length;
    renderFloatingMessageBar(state);
    showBattleResultDialog(state);
    twicaBox.innerHTML = `<a class="twica-link-button" href="https://twica.bluemoon.works" target="_blank" rel="noopener noreferrer">TwiCaで保有カードを確認</a>`;
  }

  unsubscribe = window.AM.subscribeState(currentRoom, render);
  render(window.AM.loadState(currentRoom));
})();
