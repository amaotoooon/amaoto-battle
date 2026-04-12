(function () {
  const STORAGE_PREFIX = "amaoto_battle_state__";
  const DEFAULT_ROOM = "AMAOTO1";

  function createEffects() {
    return {
      nextAttackBonus: 0,
      nextAttackBonusTurns: 0,
      nextAttackBonusPendingStart: false,
      attackBuffTurns: 0,
      attackBuffPendingStart: false,
      nextIncomingAttackNullify: 0,
      nextIncomingAttackNullifyPendingStart: false,
      damageReduceValue: 0,
      damageReduceTurns: 0,
      damageReducePendingStart: false,
      halfDamageTurns: 0,
      halfDamagePendingStart: false,
      nextAttackPenalty: 0,
      nextAttackPenaltyTurns: 0,
      nextAttackPenaltyPendingStart: false,
      nextActionRandom: 0,
      nextActionRandomPendingStart: false,
      negateNextSkill: 0,
      negateNextSkillPendingStart: false,
      regenTurns: 0,
      regenPendingStart: false,
      regenLastAppliedTurn: 0,
      goldLuckActive: false
    };
  }

  function createPlayerState(role) {
    return {
      role,
      joined: false,
      name: "",
      gold: 1000,
      bet: 50,
      debt: 0,
      hp: 100,
      shield: 0,
      bodyId: "",
      selectedCards: [],
      usedSkills: [],
      normalHealUsed: 0,
      emergencyHealUsed: false,
      submittedAction: null,
      actionLocked: false,
      message: "",
      attackUsage: { kick: 0, throw: 0 },
      cumulativeDamageDealt: 0,
      cumulativeDamageTaken: 0,
      effects: createEffects()
    };
  }

  function createEmptyState(roomCode) {
    return {
      roomCode: roomCode || DEFAULT_ROOM,
      phase: "lobby",
      turn: 1,
      players: { p1: createPlayerState("p1"), p2: createPlayerState("p2") },
      battleLog: ["ルームを作成しました。"],
      turnHistories: [],
      updatedAt: Date.now(),
      winner: null,
      lastAnimations: { p1: null, p2: null },
      turnSummary: null,
      turnResolvedAt: 0,
      firstAttackRole: null,
      resultSummary: null,
      rematchToken: 0,
      matchBet: null,
      betRevealVisible: false,
      resultRevealVisible: false,
      spectatorLogView: "first",
      roomCreated: false,
      chatHistory: [],
      turnExecutionStage: "selection",
      pendingTurnData: null
    };
  }

  function getStorageKey(roomCode) { return STORAGE_PREFIX + (roomCode || DEFAULT_ROOM); }

  function hydratePlayer(player, role) {
    const base = createPlayerState(role);
    const merged = Object.assign(base, player || {});
    merged.effects = Object.assign(createEffects(), merged.effects || {});
    if (typeof merged.effects.nextIncomingAttackNullify === "boolean") {
      merged.effects.nextIncomingAttackNullify = merged.effects.nextIncomingAttackNullify ? 1 : 0;
    }
    if (!Array.isArray(merged.selectedCards)) merged.selectedCards = [];
    if (!Array.isArray(merged.usedSkills)) merged.usedSkills = [];
    merged.attackUsage = Object.assign({ kick: 0, throw: 0 }, merged.attackUsage || {});
    if (typeof merged.cumulativeDamageDealt !== "number") merged.cumulativeDamageDealt = 0;
    if (typeof merged.cumulativeDamageTaken !== "number") merged.cumulativeDamageTaken = 0;
    return merged;
  }

  function loadState(roomCode) {
    const raw = localStorage.getItem(getStorageKey(roomCode));
    if (!raw) return createEmptyState(roomCode);
    try {
      const parsed = JSON.parse(raw);
      parsed.players = parsed.players || { p1: createPlayerState("p1"), p2: createPlayerState("p2") };
      parsed.players.p1 = hydratePlayer(parsed.players.p1, "p1");
      parsed.players.p2 = hydratePlayer(parsed.players.p2, "p2");
      parsed.lastAnimations = Object.assign({ p1: null, p2: null }, parsed.lastAnimations || {});
      if (typeof parsed.turnResolvedAt !== "number") parsed.turnResolvedAt = 0;
      if (!Object.prototype.hasOwnProperty.call(parsed, "turnSummary")) parsed.turnSummary = null;
      if (!Object.prototype.hasOwnProperty.call(parsed, "turnHistories")) parsed.turnHistories = [];
      if (!Object.prototype.hasOwnProperty.call(parsed, "firstAttackRole")) parsed.firstAttackRole = null;
      if (!Object.prototype.hasOwnProperty.call(parsed, "resultSummary")) parsed.resultSummary = null;
      if (typeof parsed.rematchToken !== "number") parsed.rematchToken = 0;
      if (!Object.prototype.hasOwnProperty.call(parsed, "matchBet")) parsed.matchBet = null;
      if (typeof parsed.betRevealVisible !== "boolean") parsed.betRevealVisible = false;
      if (typeof parsed.resultRevealVisible !== "boolean") parsed.resultRevealVisible = false;
      if (!parsed.spectatorLogView) parsed.spectatorLogView = "first";
      if (typeof parsed.roomCreated !== "boolean") parsed.roomCreated = false;
      if (!Array.isArray(parsed.chatHistory)) parsed.chatHistory = [];
      if (!parsed.turnExecutionStage) parsed.turnExecutionStage = "first";
      if (!Object.prototype.hasOwnProperty.call(parsed, "pendingTurnData")) parsed.pendingTurnData = null;
      return parsed;
    } catch (e) {
      console.warn("state parse failed", e);
      return createEmptyState(roomCode);
    }
  }

  function getChannelName(roomCode) { return `amaoto_battle_channel__${roomCode || DEFAULT_ROOM}`; }
  function broadcastState(state) {
    try {
      if (!("BroadcastChannel" in window)) return;
      const channel = new BroadcastChannel(getChannelName(state.roomCode));
      channel.postMessage({ type: "state-updated", roomCode: state.roomCode, state, sentAt: Date.now() });
      channel.close();
    } catch (e) { console.warn("broadcast failed", e); }
  }

  function saveState(state) {
    state.updatedAt = Date.now();
    localStorage.setItem(getStorageKey(state.roomCode), JSON.stringify(state));
    broadcastState(state);
    if (window.AM_SYNC && window.AM_SYNC.pushState) window.AM_SYNC.pushState(state);
    return state;
  }
  function updateState(roomCode, mutator) { const state = loadState(roomCode); mutator(state); return saveState(state); }
  function resetRoom(roomCode) { const state = createEmptyState(roomCode); saveState(state); return state; }

  function getPlayer(state, role) { return state.players[role]; }
  function getOpponentRole(role) { return role === "p1" ? "p2" : "p1"; }
  function findBody(bodyId) { return (window.AM_DATA.bodies || []).find((x) => x.bodyId === bodyId) || null; }
  function findCard(cardId) { return (window.AM_DATA.cards || []).find((x) => x.cardId === cardId) || null; }
  function findCardBySkill(skillKey) { return (window.AM_DATA.cards || []).find((x) => x.skillKey === skillKey) || null; }
  function findSkill(skillKey) { return (window.AM_DATA.skills || []).find((x) => x.skillKey === skillKey) || null; }
  function getAttackMove(moveKey) { return (window.AM_DATA.attackMoves || []).find((x) => x.key === moveKey) || null; }

  function moveLabel(moveKey) {
    const item = getAttackMove(moveKey);
    return item ? item.label : moveKey;
  }

  function describeAction(action) {
    if (!action) return "未入力";
    if (action.type === "attack") return `攻撃(${moveLabel(action.move)})`;
    if (action.type === "guard") return "防御";
    if (action.type === "evade") return "回避";
    if (action.type === "heal") return action.mode === "emergency" ? "反撃のドラ" : "回復";
    if (action.type === "blocked") return "行動無効";
    if (action.type === "nullified-skill") return "スキル無効";
    if (action.type === "skill") {
      const skill = findSkill(action.skillKey);
      return `${skill ? skill.skillName : action.skillKey}(スキル)`;
    }
    return action.type;
  }

  function formatHpShield(hp, shield) {
    if (shield > 0) {
      return `${hp}<span class="hp-shield-inline"><img src="assets/images/ui/icon_shield.png" alt="" class="inline-icon shield-inline-icon">${shield}</span>`;
    }
    return `${hp}`;
  }

  function renderHpShieldInline(hp, shield) {
    const safeHp = Number(hp || 0);
    const safeShield = Math.max(0, Number(shield || 0));
    return safeShield > 0
      ? `<span class="hp-main-value">${safeHp}</span><span class="hp-shield-inline"><img src="assets/images/ui/icon_shield.png" alt="" class="inline-icon shield-inline-icon">${safeShield}</span>`
      : `<span class="hp-main-value">${safeHp}</span>`;
  }

  function createCardHTML(card, extra) {
    if (!card) return "";
    const extraHtml = extra ? `<div class="card-meta">${escapeHtml(extra)}</div>` : "";
    return `
      <div class="card-unit rarity-${escapeHtml(card.rarity)}">
        <img src="${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.cardName)}" class="card-image" />
        <div class="card-body">
          <div class="card-title-row">
            <div class="card-title">${escapeHtml(card.cardName)}</div>
            <div class="card-rarity">${escapeHtml(card.rarity || "")}</div>
          </div>
          <div class="card-skill">${escapeHtml(card.skillName || "")}</div>
          <div class="card-effect">${escapeHtml(card.effectShort || "")}</div>
          ${extraHtml}
        </div>
      </div>
    `;
  }

  function createBodyHTML(body, selected) {
    const cls = selected ? "body-unit selected" : "body-unit";
    if (!body) return "";
    return `
      <div class="${cls}" data-body-id="${escapeHtml(body.bodyId)}">
        <img src="${escapeHtml(body.imagePath)}" alt="${escapeHtml(body.bodyName)}" class="body-image" />
        <div class="card-body">
          <div class="body-name">${escapeHtml(body.bodyName)}</div>
          <div class="body-meta">HP ${escapeHtml(String(body.hp || 100))}</div>
        </div>
      </div>
    `;
  }

  function createBodyIconHTML(body, label) {
    if (!body) return `<div class="body-icon-shell placeholder">${escapeHtml(label || "")}</div>`;
    return `
      <div class="body-icon-shell">
        ${body.iconPath ? `<img src="${escapeHtml(body.iconPath)}" alt="${escapeHtml(body.bodyName)}" class="body-icon-image" />` : ""}
      </div>`;
  }

  function createEffectBadges(player) {
    const e = player.effects || {};
    const items = [];
    if (player.shield > 0) items.push(`シールド ${player.shield}`);
    if ((e.nextIncomingAttackNullify || 0) > 0) items.push(`攻撃無効 ${e.nextIncomingAttackNullifyPendingStart ? "次ターン" : `残${e.nextIncomingAttackNullify}ターン`}`);
    if ((e.halfDamageTurns || 0) > 0) items.push(`被ダメ半減 ${e.halfDamagePendingStart ? "次ターン" : `残${e.halfDamageTurns}ターン`}`);
    if ((e.damageReduceTurns || 0) > 0 && e.damageReduceValue > 0) items.push(`被ダメ-${e.damageReduceValue} ${e.damageReducePendingStart ? "次ターン" : `残${e.damageReduceTurns}ターン`}`);
    if ((e.attackBuffTurns || 0) > 0) items.push(`攻撃+6 ${e.attackBuffPendingStart ? "次ターン" : `残${e.attackBuffTurns}ターン`}`);
    if ((e.nextAttackBonusTurns || 0) > 0 && e.nextAttackBonus > 0) items.push(`攻撃+${e.nextAttackBonus} ${e.nextAttackBonusPendingStart ? "次ターン" : `残${e.nextAttackBonusTurns}ターン`}`);
    if ((e.nextAttackPenaltyTurns || 0) > 0 && e.nextAttackPenalty > 0) items.push(`攻撃-${e.nextAttackPenalty} ${e.nextAttackPenaltyPendingStart ? "次ターン" : `残${e.nextAttackPenaltyTurns}ターン`}`);
    if ((e.regenTurns || 0) > 0) items.push(`自動回復 ${e.regenPendingStart ? "次ターン" : `残${e.regenTurns}ターン`}`);
    if ((e.nextActionRandom || 0) > 0) items.push(`行動ランダム ${e.nextActionRandomPendingStart ? "次ターン" : `残${e.nextActionRandom}ターン`}`);
    if ((e.negateNextSkill || 0) > 0) items.push(`相手スキル無効 ${e.negateNextSkillPendingStart ? "次ターン" : `残${e.negateNextSkill}ターン`}`);
    if (e.goldLuckActive) items.push("金運UP待機中");
    return items.map((t) => `<span class="effect-badge">${escapeHtml(t)}</span>`).join("");
  }

  function createRulesHTML() {
    const icon = (src, label) => `<img src="${src}" alt="" class="inline-icon">${label}`;
    return `
      <div class="rules-block rules-block-rich">
        <h3>このゲームについて</h3>
        <p>ターン制・BET総取り式の配信向け対戦ゲームです。</p>
        <h3>バトルの基本</h3>
        <p>①本ゲームは「ターン制」「BET額総取り式」です。<br>初ターンに先攻後攻がランダム付与され、以降は交互に進行します。<br>エントリー時にBET額を設定し、勝者はBET総額を獲得します。最低BET額は50Gで、不足分は借金として扱います。</p>
        <p>②デッキ構成はボディHP100＋スキルカード3枚です。<br>レア★2で揃えた場合のみ、デッキボーナスとして対戦開始時にシールド10を獲得できます。</p>
        <p>③どちらかのHPが0になったら対戦終了です。<br>10ターンで決着がつかない場合は、10ターン終了時の残HPが多い方が勝者となります。</p>
        <h3>毎ターンの行動</h3>
        <p>${icon('assets/images/ui/icon_attack.png','攻撃(こぶし)')}：18〜22ダメージ<br>${icon('assets/images/ui/icon_attack.png','攻撃(足蹴り)')}：24ダメージ（2回まで）<br>${icon('assets/images/ui/icon_attack.png','攻撃(背負い投げ)')}：32ダメージ（1回まで）<br>${icon('assets/images/ui/icon_potion.png','回復')}：HP20回復（1回まで）<br>${icon('assets/images/ui/icon_shield.png','防御')}：ダメージ10軽減<br>${icon('assets/images/ui/icon_shield.png','回避')}：50％の確率で相手の攻撃を無効化<br>${icon('assets/images/ui/hi_01.png','反撃のドラ')}：HPを50まで回復（HP15以下で使用可能／「いたずら」のランダム対象）<br>${icon('assets/images/ui/icon_book.png','スキル発動')}：1ゲームにつき各1回まで発動可能</p>
        <h3>ヒント</h3>
        <p>先後攻によって効能差があるので、戦況を読んで行動選択しましょう。<br>うまく機能しなかった場合も、配信のエンタメとしてお楽しみください。</p>
      </div>`;
  }

  function ensureRulesModal() {
    let modal = document.getElementById("rules-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "rules-modal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="modal-backdrop" data-close-modal="true"></div>
      <div class="modal-panel large rules-modal-panel ${document.body.classList.contains("spectator-page") ? "fullscreen-ish" : ""}">
        <button class="modal-close" type="button" data-close-modal="true">閉じる</button>
        <div class="modal-content">${createRulesHTML()}</div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.getAttribute("data-close-modal") === "true") {
        modal.classList.add("hidden");
      }
    });
    return modal;
  }
  function openRulesModal() { ensureRulesModal().classList.remove("hidden"); }

  function subscribeState(roomCode, callback) {
    let last = null, timer = null, channel = null, remoteUnsubscribe = null;
    function emit(nextState) {
      const state = nextState || loadState(roomCode);
      const next = JSON.stringify(state);
      if (next !== last) { last = next; callback(state); }
    }
    function handleStorage(e) { if (e && e.key && e.key !== getStorageKey(roomCode)) return; emit(); }
    emit();
    if (window.AM_SYNC && window.AM_SYNC.subscribe) {
      remoteUnsubscribe = window.AM_SYNC.subscribe(roomCode, (remoteState) => {
        const local = loadState(roomCode);
        if (!local.updatedAt || (remoteState.updatedAt || 0) > (local.updatedAt || 0)) {
          localStorage.setItem(getStorageKey(roomCode), JSON.stringify(remoteState));
          emit(remoteState);
        }
      });
    }
    if ("BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel(getChannelName(roomCode));
        channel.addEventListener("message", (event) => {
          const data = event.data || {};
          if (data.roomCode !== roomCode) return;
          if (data.state) emit(data.state); else emit();
        });
      } catch (e) { console.warn("channel subscribe failed", e); }
    }
    timer = setInterval(emit, 800);
    window.addEventListener("storage", handleStorage);
    return function unsubscribe() {
      clearInterval(timer);
      window.removeEventListener("storage", handleStorage);
      if (channel) channel.close();
      if (remoteUnsubscribe) remoteUnsubscribe();
    };
  }

  function escapeHtml(text) {
    return String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }


  function circledTurn(value) {
    const nums = ['⓪','①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
    const n = Number(value || 0);
    return nums[n] || String(value || '');
  }

  function formatTurnLabel(value) {
    return `ターン${circledTurn(value)}`;
  }

  function formatTurnLogLabel(value) {
    return `${circledTurn(value)}ターン目`;
  }


  function phaseTurnStatus(state, role, view = 'player') {
    if (!state || state.phase !== 'battle') return '待機';
    const firstRole = state.firstAttackRole || 'p1';
    const isFirst = firstRole === role;
    if (state.turnExecutionStage === 'selection') {
      if (view === 'spectator') return `次：${isFirst ? '先' : '後'}`;
      return '行動選択';
    }
    if (view === 'spectator') return isFirst ? '先' : '後';
    return `${formatTurnLabel(state.turn)}：${isFirst ? '先攻' : '後攻'}`;
  }

  function battlePhaseLabel(state, joined) {
    if (!state) return '対戦開始前';
    if (state.phase === 'finished') return '対戦終了';
    if (state.phase !== 'battle') return joined ? '対戦開始待ち' : '対戦開始前';
    const turn = formatTurnLabel(state.turn);
    if (state.turnExecutionStage === 'selection') return `${turn}行動選択中`;
    return `${turn}`;
  }

  function decorateLogLine(text) {
    const raw = String(text || '');
    if (raw.includes('<img')) return raw;
    let line = escapeHtml(raw);
    line = line.replace(/ーー▼(\d+)ターン目/g, (_, n) => `ーー▼${formatTurnLogLabel(n)}`);
    line = line.replace(/(ターン)(\d+)/g, (_, a, n) => `${a}${circledTurn(n)}`);
    const iconMap = {
      'icon_player_left.png': 'assets/images/ui/icon_player_left.png',
      'icon_player_right.png': 'assets/images/ui/icon_player_right.png',
      'icon_attack.png': 'assets/images/ui/icon_attack.png',
      'icon_potion.png': 'assets/images/ui/icon_potion.png',
      'icon_shield.png': 'assets/images/ui/icon_shield.png',
      'icon_coin.png': 'assets/images/ui/icon_coin.png',
      'icon_book.png': 'assets/images/ui/icon_book.png',
      'hi_01.png': 'assets/images/ui/hi_01.png'
    };
    const iconHtml = (file, extraClass = 'inline-icon') => {
      const src = iconMap[file];
      return src ? `<img src="${src}" alt="" class="${extraClass}">` : '';
    };
    line = line.replace(/&lt;span class=&quot;hp-shield-inline&quot;&gt;&lt;img src=&quot;assets\/images\/ui\/icon_shield\.png&quot; alt=&quot;&quot; class=&quot;inline-icon shield-inline-icon&quot;&gt;(\d+)&lt;\/span&gt;/g, (_, value) => `${iconHtml('icon_shield.png', 'inline-icon shield-inline-icon')}${value}`);
    line = line.replace(/&lt;img src=&quot;assets\/images\/ui\/(icon_player_left\.png|icon_player_right\.png|icon_attack\.png|icon_potion\.png|icon_shield\.png|icon_coin\.png|icon_book\.png|hi_01\.png)&quot; alt=&quot;&quot; class=&quot;([^&]*)&quot;&gt;/g, (_, file, cls) => iconHtml(file, cls || 'inline-icon'));
    line = line.replace(/(icon_player_left\.png|icon_player_right\.png)\s*/g, (_, file) => `${iconHtml(file)} `);
    line = line.replace(/(は「)(?:(icon_attack\.png|icon_potion\.png|icon_shield\.png|icon_coin\.png|icon_book\.png|hi_01\.png)\s+)?([^」]+)(」を選択！)/g,
      (_, a, file, label, c) => `${a}${file ? iconHtml(file) : ''}${label}${c}`);
    line = line.replace(/(?:^|\s)(icon_attack\.png|icon_potion\.png|icon_shield\.png|icon_coin\.png|icon_book\.png|hi_01\.png)(?=\s|$)/g, (_, file) => iconHtml(file));
    line = line.replace(/🛡️(\d+)/g, (_, value) => `${iconHtml('icon_shield.png', 'inline-icon shield-inline-icon')}${value}`);
    line = line.replace(/(シールドを)(\d+)(得た！)/g, (_, a, b, c) => `${a}${iconHtml('icon_shield.png', 'inline-icon shield-inline-icon')}${b}${c}`);
    line = line.replace(/(シールドが)(\d+)(ダメージを防いだ！)/g, (_, a, b, c) => `${a}${iconHtml('icon_shield.png', 'inline-icon shield-inline-icon')}${b}${c}`);
    line = line.replace(/(HPを)(\d+)(回復した！)/g, (_, a, b, c) => `${iconHtml('icon_potion.png')}${a}${b}${c}`);
    line = line.replace(/(<img[^>]*icon_shield\.png[^>]*>)(\s*<img[^>]*icon_shield\.png[^>]*>)+/g, '$1');
    return line;
  }

  window.AM = { DEFAULT_ROOM, createEffects, createEmptyState, loadState, saveState, updateState, resetRoom, getPlayer, getOpponentRole, findBody, findCard, findCardBySkill, findSkill, getAttackMove, moveLabel, describeAction, formatHpShield, createCardHTML, createBodyHTML, createBodyIconHTML, createEffectBadges, openRulesModal, subscribeState, escapeHtml, broadcastState, circledTurn, formatTurnLabel, formatTurnLogLabel, decorateLogLine, createRulesHTML, renderHpShieldInline, phaseTurnStatus, battlePhaseLabel };
})();
