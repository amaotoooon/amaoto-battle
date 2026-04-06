(function () {
  const STORAGE_PREFIX = "amaoto_battle_state__";
  const DEFAULT_ROOM = "AMAOTO1";

  function createEffects() {
    return {
      nextAttackBonus: 0,
      attackBuffTurns: 0,
      nextIncomingAttackNullify: false,
      nextDamageHalf: false,
      oneShotDamageReduce: 0,
      flexibilityHits: 0,
      nextAttackPenalty: 0,
      nextActionRandom: false,
      blockNextSkill: false,
      negateNextDebuff: false,
      regenTurns: 0,
      goldLuckActive: false
    };
  }

  function createPlayerState(role) {
    return {
      role: role,
      joined: false,
      name: "",
      gold: 1000,
      hp: 100,
      shield: 0,
      bodyId: "",
      selectedCards: [],
      usedSkills: [],
      normalHealUsed: 0,
      emergencyHealUsed: false,
      submittedAction: null,
      actionLocked: false,
      effects: createEffects()
    };
  }

  function createEmptyState(roomCode) {
    return {
      roomCode: roomCode || DEFAULT_ROOM,
      phase: "lobby",
      turn: 1,
      lastActor: "",
      pendingSpectatorRules: false,
      players: {
        p1: createPlayerState("p1"),
        p2: createPlayerState("p2")
      },
      battleLog: ["ルームを作成しました。"],
      updatedAt: Date.now(),
      winner: null,
      lastAnimation: null,
      lastAnimations: { p1: null, p2: null },
      resolvedThisTurn: false
    };
  }

  function getStorageKey(roomCode) {
    return STORAGE_PREFIX + (roomCode || DEFAULT_ROOM);
  }

  function loadState(roomCode) {
    const raw = localStorage.getItem(getStorageKey(roomCode));
    if (!raw) return createEmptyState(roomCode);
    try {
      const parsed = JSON.parse(raw);
      parsed.players = parsed.players || { p1: createPlayerState("p1"), p2: createPlayerState("p2") };
      if (!parsed.players.p1) parsed.players.p1 = createPlayerState("p1");
      if (!parsed.players.p2) parsed.players.p2 = createPlayerState("p2");
      parsed.players.p1.effects = Object.assign(createEffects(), parsed.players.p1.effects || {});
      parsed.players.p2.effects = Object.assign(createEffects(), parsed.players.p2.effects || {});
      parsed.lastAnimations = Object.assign({ p1: null, p2: null }, parsed.lastAnimations || {});
      return parsed;
    } catch (e) {
      console.warn("state parse failed", e);
      return createEmptyState(roomCode);
    }
  }

  function getChannelName(roomCode) {
    return `amaoto_battle_channel__${roomCode || DEFAULT_ROOM}`;
  }

  function broadcastState(state) {
    try {
      if (!("BroadcastChannel" in window)) return;
      const channel = new BroadcastChannel(getChannelName(state.roomCode));
      channel.postMessage({ type: "state-updated", roomCode: state.roomCode, state: state, sentAt: Date.now() });
      channel.close();
    } catch (e) {
      console.warn("broadcast failed", e);
    }
  }

  function saveState(state) {
    state.updatedAt = Date.now();
    localStorage.setItem(getStorageKey(state.roomCode), JSON.stringify(state));
    broadcastState(state);
    if (window.AM_SYNC && window.AM_SYNC.pushState) window.AM_SYNC.pushState(state);
    return state;
  }

  function updateState(roomCode, mutator) {
    const state = loadState(roomCode);
    mutator(state);
    return saveState(state);
  }

  function resetRoom(roomCode) {
    const state = createEmptyState(roomCode);
    saveState(state);
    return state;
  }

  function getPlayer(state, role) { return state.players[role]; }
  function getOpponentRole(role) { return role === "p1" ? "p2" : "p1"; }
  function findBody(bodyId) { return (window.AM_DATA.bodies || []).find((x) => x.bodyId === bodyId) || null; }
  function findCard(cardId) { return (window.AM_DATA.cards || []).find((x) => x.cardId === cardId) || null; }
  function findCardBySkill(skillKey) { return (window.AM_DATA.cards || []).find((x) => x.skillKey === skillKey) || null; }
  function findSkill(skillKey) { return (window.AM_DATA.skills || []).find((x) => x.skillKey === skillKey) || null; }
  function moveLabel(moveKey) {
    const item = (window.AM_DATA.attackMoves || []).find((x) => x.key === moveKey);
    return item ? item.label : moveKey;
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

  function createEffectBadges(player) {
    const e = player.effects || {};
    const items = [];
    if (player.shield > 0) items.push(`シールド ${player.shield}`);
    if (e.nextIncomingAttackNullify) items.push("次の攻撃を無効");
    if (e.nextDamageHalf) items.push("次の被ダメ半減");
    if (e.oneShotDamageReduce > 0) items.push(`次の被ダメ-${e.oneShotDamageReduce}`);
    if (e.flexibilityHits > 0) items.push(`被ダメ-6 残り${e.flexibilityHits}回`);
    if (e.attackBuffTurns > 0) items.push(`攻撃+6 残り${e.attackBuffTurns}ターン`);
    if (e.nextAttackBonus > 0) items.push(`次の攻撃+${e.nextAttackBonus}`);
    if (e.nextAttackPenalty > 0) items.push(`次の攻撃-${e.nextAttackPenalty}`);
    if (e.regenTurns > 0) items.push(`自動回復 残り${e.regenTurns}ターン`);
    if (e.nextActionRandom) items.push("次の行動がランダム");
    if (e.blockNextSkill) items.push("次のスキル無効");
    if (e.negateNextDebuff) items.push("妨害スキルを1回無効");
    if (e.goldLuckActive) items.push("金運UP待機中");
    return items.map((t) => `<span class="effect-badge">${escapeHtml(t)}</span>`).join("");
  }

  function createRulesHTML() {
    const lines = (window.AM_DATA.rulesText || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
    const twica = (window.AM_DATA.twicaText || []).map((x) => `<p>${escapeHtml(x)}</p>`).join("");
    return `<div class="rules-block"><h3>遊び方</h3><ul>${lines}</ul><h3>TWiCaカードの選択について</h3>${twica}</div>`;
  }

  function ensureRulesModal() {
    let modal = document.getElementById("rules-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "rules-modal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="modal-backdrop" data-close-modal="true"></div>
      <div class="modal-panel">
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
    let last = null;
    let timer = null;
    let channel = null;
    let remoteUnsubscribe = null;

    function emit(nextState) {
      const state = nextState || loadState(roomCode);
      const next = JSON.stringify(state);
      if (next !== last) {
        last = next;
        callback(state);
      }
    }

    function handleStorage(e) {
      if (e && e.key && e.key !== getStorageKey(roomCode)) return;
      emit();
    }

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
          if (data.state) emit(data.state);
          else emit();
        });
      } catch (e) {
        console.warn("channel subscribe failed", e);
      }
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
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  window.AM = { DEFAULT_ROOM, createEffects, createEmptyState, loadState, saveState, updateState, resetRoom, getPlayer, getOpponentRole, findBody, findCard, findCardBySkill, findSkill, moveLabel, createCardHTML, createBodyHTML, createEffectBadges, openRulesModal, subscribeState, escapeHtml, broadcastState };
})();
