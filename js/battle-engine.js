
(function () {
  const ATTACK_VALUES = {
    punch: 18,
    kick: 24,
    throw: 32
  };

  const DEBUFF_SKILLS = new Set(["speech", "prank", "trouble_guard"]);

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function canUseSkill(player, skillKey) {
    return !player.usedSkills.includes(skillKey);
  }

  function normalHeal(player, logs) {
    if (player.normalHealUsed >= 2) {
      logs.push(`${player.name}は通常回復をこれ以上使えません。`);
      return;
    }
    player.normalHealUsed += 1;
    const before = player.hp;
    player.hp = Math.min(100, player.hp + 20);
    logs.push(`${player.name}はHPを${player.hp - before}回復した。`);
  }

  function emergencyHeal(player, logs) {
    if (player.emergencyHealUsed) {
      logs.push(`${player.name}は瀕死回復をすでに使っています。`);
      return;
    }
    if (player.hp > 15) {
      logs.push(`${player.name}はまだ瀕死回復を使えません。`);
      return;
    }
    player.emergencyHealUsed = true;
    const before = player.hp;
    player.hp = Math.max(player.hp, 80);
    logs.push(`${player.name}は瀕死回復でHPを${player.hp - before}回復した。`);
  }

  function applyDamage(attacker, defender, baseDamage, actionContext, logs) {
    let damage = baseDamage;

    if (attacker.effects.nextAttackPenalty > 0) {
      damage -= attacker.effects.nextAttackPenalty;
      logs.push(`${attacker.name}の攻撃は話術の影響で勢いが落ちた。`);
      attacker.effects.nextAttackPenalty = 0;
    }

    if (attacker.effects.nextAttackBonus > 0) {
      damage += attacker.effects.nextAttackBonus;
      logs.push(`${attacker.name}の攻撃に追加威力が乗った。`);
      attacker.effects.nextAttackBonus = 0;
    }

    if (attacker.effects.attackBuffTurns > 0) {
      damage += 6;
    }

    if (actionContext.defenderAction && actionContext.defenderAction.type === "guard") {
      damage = actionContext.move === "throw" ? 8 : Math.ceil(damage / 2);
      logs.push(`${defender.name}はガードした。`);
    }

    if (defender.effects.nextIncomingAttackNullify) {
      logs.push(`${defender.name}は攻撃を無効にした。`);
      defender.effects.nextIncomingAttackNullify = false;
      damage = 0;
    }

    if (defender.effects.nextDamageHalf) {
      damage = Math.ceil(damage / 2);
      defender.effects.nextDamageHalf = false;
      logs.push(`${defender.name}は被ダメージ半減を発動した。`);
    }

    if (defender.effects.oneShotDamageReduce > 0) {
      damage = Math.max(0, damage - defender.effects.oneShotDamageReduce);
      logs.push(`${defender.name}はダメージを${defender.effects.oneShotDamageReduce}軽減した。`);
      defender.effects.oneShotDamageReduce = 0;
    }

    if (defender.effects.flexibilityHits > 0) {
      damage = Math.max(0, damage - 6);
      defender.effects.flexibilityHits -= 1;
      logs.push(`${defender.name}の柔軟性がダメージを和らげた。`);
    }

    damage = Math.max(0, damage);

    if (defender.shield > 0 && damage > 0) {
      const absorbed = Math.min(defender.shield, damage);
      defender.shield -= absorbed;
      damage -= absorbed;
      logs.push(`${defender.name}のシールドが${absorbed}ダメージを吸収。`);
    }

    defender.hp = Math.max(0, defender.hp - damage);
    logs.push(`${attacker.name}の${window.AM.moveLabel(actionContext.move)}。${defender.name}に${damage}ダメージ。`);
    return damage;
  }

  function randomActionFor(player) {
    const basic = [
      { type: "attack", move: "punch" },
      { type: "attack", move: "kick" },
      { type: "attack", move: "throw" },
      { type: "guard" }
    ];
    if (player.normalHealUsed < 2) basic.push({ type: "heal", mode: "normal" });
    if (player.hp <= 15 && !player.emergencyHealUsed) basic.push({ type: "heal", mode: "emergency" });
    const availableSkills = player.selectedCards
      .map((id) => window.AM.findCard(id))
      .filter(Boolean)
      .filter((card) => !player.usedSkills.includes(card.skillKey));
    availableSkills.forEach((card) => basic.push({ type: "skill", skillKey: card.skillKey }));
    return basic[randomInt(0, basic.length - 1)];
  }

  function preprocessAction(player, opponent, action, logs) {
    let nextAction = action ? deepClone(action) : { type: "guard" };

    if (player.effects.nextActionRandom) {
      nextAction = randomActionFor(player);
      player.effects.nextActionRandom = false;
      logs.push(`${player.name}の行動はいたずらでランダムになった。`);
    }

    if (nextAction.type === "skill" && player.effects.blockNextSkill) {
      logs.push(`${player.name}のスキルはトラブル回避で無効になった。`);
      player.effects.blockNextSkill = false;
      return { type: "guard" };
    }

    if (nextAction.type === "skill" && opponent.effects.negateNextDebuff && DEBUFF_SKILLS.has(nextAction.skillKey)) {
      logs.push(`${opponent.name}は礼儀・作法で妨害スキルを無効化した。`);
      opponent.effects.negateNextDebuff = false;
      return { type: "guard" };
    }

    return nextAction;
  }

  function processSkill(caster, target, skillKey, logs, state) {
    const skill = window.AM.findSkill(skillKey);
    if (!skill) {
      logs.push(`${caster.name}は不明なスキルを使おうとした。`);
      return;
    }
    const card = window.AM.findCardBySkill(skillKey);
    caster.usedSkills.push(skillKey);
    state.lastAnimation = {
      playerName: caster.name,
      cardName: card ? card.cardName : skill.skillName,
      skillName: skill.skillName,
      effectShort: skill.effectShort,
      imagePath: card ? card.imagePath : "",
      effectType: skill.effectType || "特殊"
    };
    state.lastAnimations = state.lastAnimations || { p1: null, p2: null };
    state.lastAnimations[caster.role] = { ...state.lastAnimation };

    switch (skillKey) {
      case "gold_luck":
        caster.effects.goldLuckActive = true;
        logs.push(`${caster.name}は金運UPを発動した。`);
        break;
      case "speech":
        target.effects.nextAttackPenalty += 8;
        logs.push(`${caster.name}の話術で、${target.name}の次の攻撃が弱まる。`);
        break;
      case "charm_up": {
        const before = caster.hp;
        caster.hp = Math.min(100, caster.hp + 25);
        caster.effects.nextDamageHalf = true;
        logs.push(`${caster.name}は魅力UP。HPを${caster.hp - before}回復し、次の被ダメージを半減。`);
        break;
      }
      case "float":
        caster.effects.nextIncomingAttackNullify = true;
        logs.push(`${caster.name}は浮遊で次の攻撃を無効化する。`);
        break;
      case "trouble_guard":
        target.effects.blockNextSkill = true;
        logs.push(`${caster.name}はトラブル回避。${target.name}の次のスキルを無効化する。`);
        break;
      case "martial_arts":
        caster.effects.nextAttackBonus += 10;
        logs.push(`${caster.name}は体術で次の攻撃を強化した。`);
        break;
      case "cooking": {
        const before = caster.hp;
        caster.hp = Math.min(100, caster.hp + 20);
        logs.push(`${caster.name}は料理スキルでHPを${caster.hp - before}回復した。`);
        break;
      }
      case "metabolism":
        caster.effects.regenTurns = Math.max(caster.effects.regenTurns, 3);
        logs.push(`${caster.name}は代謝向上。3ターンの自動回復を得た。`);
        break;
      case "heal": {
        const before = caster.hp;
        caster.hp = Math.min(100, caster.hp + 35);
        logs.push(`${caster.name}はHPを${caster.hp - before}回復した。`);
        break;
      }
      case "wild": {
        const dmg = randomInt(10, 24);
        applyDamage(caster, target, dmg, { move: "わんぱく", defenderAction: null }, logs);
        break;
      }
      case "prank":
        target.effects.nextActionRandom = true;
        logs.push(`${caster.name}のいたずらで、${target.name}の次の行動はランダムになる。`);
        break;
      case "kindness": {
        const before = caster.hp;
        caster.hp = Math.min(100, caster.hp + 15);
        caster.effects.oneShotDamageReduce += 5;
        logs.push(`${caster.name}はやさしさを発動。HPを${caster.hp - before}回復し、次の被ダメージを5軽減。`);
        break;
      }
      case "flexibility":
        caster.effects.flexibilityHits = Math.max(caster.effects.flexibilityHits, 2);
        logs.push(`${caster.name}は柔軟性で次の2回の被ダメージを6軽減する。`);
        break;
      case "sharpness":
        caster.effects.nextAttackBonus += 8;
        logs.push(`${caster.name}は切れ味UPで次の攻撃を強化した。`);
        break;
      case "motivation":
        caster.effects.attackBuffTurns = Math.max(caster.effects.attackBuffTurns, 2);
        logs.push(`${caster.name}はやる気UPで2ターン攻撃強化。`);
        break;
      case "stamina":
        caster.shield += 20;
        logs.push(`${caster.name}はシールド20を得た。`);
        break;
      case "mystic_power": {
        const roll = randomInt(1, 4);
        if (roll === 1) {
          applyDamage(caster, target, 20, { move: "不思議な力", defenderAction: null }, logs);
        } else if (roll === 2) {
          const before = caster.hp;
          caster.hp = Math.min(100, caster.hp + 20);
          logs.push(`${caster.name}は不思議な力でHPを${caster.hp - before}回復した。`);
        } else if (roll === 3) {
          caster.shield += 15;
          logs.push(`${caster.name}は不思議な力でシールド15を得た。`);
        } else {
          caster.effects.nextAttackBonus += 8;
          logs.push(`${caster.name}は不思議な力で次の攻撃を強化した。`);
        }
        break;
      }
      case "calm_mind":
        caster.effects.oneShotDamageReduce += 10;
        logs.push(`${caster.name}は冷静力で次の被ダメージを10軽減する。`);
        break;
      case "manners": {
        const before = caster.hp;
        caster.hp = Math.min(100, caster.hp + 10);
        caster.effects.negateNextDebuff = true;
        logs.push(`${caster.name}は礼儀・作法。HPを${caster.hp - before}回復し、次の妨害スキルを無効にする。`);
        break;
      }
      case "explosion": {
        applyDamage(caster, target, 40, { move: "？？？", defenderAction: null }, logs);
        if (Math.random() < 0.5) {
          caster.hp = Math.max(0, caster.hp - 15);
          logs.push(`${caster.name}は暴発で15ダメージを受けた。`);
        }
        break;
      }
      case "stealth":
        caster.effects.nextIncomingAttackNullify = true;
        caster.effects.nextAttackBonus += 8;
        logs.push(`${caster.name}はステルス。次の攻撃を無効にし、次の攻撃を強化。`);
        break;
      default:
        logs.push(`${caster.name}は${skill.skillName}を使った。`);
    }
  }

  function processAction(actor, target, actorAction, targetAction, logs, state) {
    if (actor.hp <= 0) return;

    switch (actorAction.type) {
      case "attack":
        applyDamage(actor, target, ATTACK_VALUES[actorAction.move] || 0, { move: actorAction.move, defenderAction: targetAction }, logs);
        break;
      case "guard":
        logs.push(`${actor.name}は守りを固めた。`);
        break;
      case "heal":
        if (actorAction.mode === "emergency") emergencyHeal(actor, logs);
        else normalHeal(actor, logs);
        break;
      case "skill":
        if (!canUseSkill(actor, actorAction.skillKey)) {
          logs.push(`${actor.name}はそのスキルをもう使えない。`);
          break;
        }
        processSkill(actor, target, actorAction.skillKey, logs, state);
        break;
      default:
        logs.push(`${actor.name}は様子を見ている。`);
    }
  }

  function applyEndTurnEffects(player, logs) {
    if (player.effects.regenTurns > 0 && player.hp > 0) {
      const before = player.hp;
      player.hp = Math.min(100, player.hp + 5);
      player.effects.regenTurns -= 1;
      logs.push(`${player.name}は自動回復でHPを${player.hp - before}回復した。`);
    }
    if (player.effects.attackBuffTurns > 0) {
      player.effects.attackBuffTurns -= 1;
    }
  }

  function determineWinner(state, logs) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    if (p1.hp <= 0 && p2.hp <= 0) {
      state.winner = "draw";
      state.phase = "finished";
      logs.push("両者戦闘不能。引き分け。");
      p1.gold += 50;
      p2.gold += 50;
      return;
    }
    if (p1.hp <= 0) {
      state.winner = "p2";
      state.phase = "finished";
      awardWinner(state, "p2", logs);
      return;
    }
    if (p2.hp <= 0) {
      state.winner = "p1";
      state.phase = "finished";
      awardWinner(state, "p1", logs);
      return;
    }
    if (state.turn > 10) {
      state.phase = "finished";
      if (p1.hp === p2.hp) {
        state.winner = "draw";
        logs.push("10ターン終了。同HPのため引き分け。");
        p1.gold += 50;
        p2.gold += 50;
      } else {
        const winnerRole = p1.hp > p2.hp ? "p1" : "p2";
        state.winner = winnerRole;
        logs.push(`10ターン終了。残りHPが多い${state.players[winnerRole].name}の勝ち。`);
        awardWinner(state, winnerRole, logs);
      }
    }
  }

  function awardWinner(state, winnerRole, logs) {
    const winner = state.players[winnerRole];
    let reward = 100;
    if (winner.effects.goldLuckActive) {
      const multiplier = randomInt(12, 18) / 10;
      reward = Math.round(reward * multiplier);
      logs.push(`${winner.name}の金運UPで報酬が${multiplier.toFixed(1)}倍になった。`);
    }
    winner.gold += reward;
    logs.push(`${winner.name}の勝利。${reward}G獲得。`);
  }

  function startMatch(state) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    if (!p1.joined || !p2.joined) {
      throw new Error("両プレイヤーの参加登録が必要です。");
    }
    if (!p1.bodyId || !p2.bodyId) {
      throw new Error("両プレイヤーのボディ選択が必要です。");
    }
    if (p1.selectedCards.length !== 3 || p2.selectedCards.length !== 3) {
      throw new Error("両プレイヤーはカードを3枚選ぶ必要があります。");
    }

    ["p1", "p2"].forEach((role) => {
      const player = state.players[role];
      player.hp = 100;
      player.shield = 0;
      player.usedSkills = [];
      player.normalHealUsed = 0;
      player.emergencyHealUsed = false;
      player.submittedAction = null;
      player.actionLocked = false;
      player.effects = window.AM.createEmptyState ? window.AM.createEmptyState().players.p1.effects : {
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
      player.gold = Math.max(0, player.gold - 50);
    });
    state.turn = 1;
    state.phase = "battle";
    state.winner = null;
    state.lastAnimation = null;
    state.lastAnimations = { p1: null, p2: null };
    state.battleLog = ["対戦開始。各プレイヤーから50Gを支払いました。"];
    state.resolvedThisTurn = false;
    state.turnSummary = null;
    state.turnResolvedAt = 0;
  }

  function resolveTurn(state) {
    if (state.phase !== "battle") return state;
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    if (!p1.actionLocked || !p2.actionLocked) {
      throw new Error("両プレイヤーの行動確定が必要です。");
    }

    const logs = [`--- ターン ${state.turn} ---`];
    state.lastAnimation = null;
    state.lastAnimations = { p1: null, p2: null };
    const hpBefore = { p1: p1.hp, p2: p2.hp };

    const action1 = preprocessAction(p1, p2, p1.submittedAction, logs);
    const action2 = preprocessAction(p2, p1, p2.submittedAction, logs);

    const order = Math.random() < 0.5 ? ["p1", "p2"] : ["p2", "p1"];
    logs.push(`先手は${state.players[order[0]].name}。`);

    const first = state.players[order[0]];
    const second = state.players[order[1]];
    const firstAction = order[0] === "p1" ? action1 : action2;
    const secondAction = order[0] === "p1" ? action2 : action1;

    processAction(first, second, firstAction, secondAction, logs, state);
    if (second.hp > 0) {
      processAction(second, first, secondAction, firstAction, logs, state);
    }

    applyEndTurnEffects(p1, logs);
    applyEndTurnEffects(p2, logs);

    const turnSummary = {
      turn: state.turn,
      firstPlayerRole: order[0],
      firstPlayerName: state.players[order[0]].name,
      entries: [
        { role: 'p1', name: p1.name, actionLabel: window.AM.describeAction ? window.AM.describeAction(action1) : '' },
        { role: 'p2', name: p2.name, actionLabel: window.AM.describeAction ? window.AM.describeAction(action2) : '' }
      ],
      hpDelta: {
        p1: p1.hp - hpBefore.p1,
        p2: p2.hp - hpBefore.p2
      },
      highlights: logs.slice(1, 6)
    };

    p1.submittedAction = null;
    p2.submittedAction = null;
    p1.actionLocked = false;
    p2.actionLocked = false;
    state.resolvedThisTurn = true;
    state.turnSummary = turnSummary;
    state.turnResolvedAt = Date.now();
    state.turn += 1;

    determineWinner(state, logs);

    state.battleLog = logs.concat(state.battleLog).slice(0, 80);
    return state;
  }

  window.AM_BATTLE = {
    startMatch,
    resolveTurn,
    randomActionFor
  };
})();
